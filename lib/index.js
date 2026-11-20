import { join } from 'node:path'
import { ExpertLibrary } from './library.js'
import { dshHome, resolveDataDirSync } from './datadir.js'
import { createExpertProvider } from './provider.js'
import { registerExpertTools } from './tools.js'
import { registerTraceHooks, consultState } from './trace.js'
import { createRetriever } from './retrieval.js'
import { createRoutes } from './routes.js'
import { registerPrompt, setPromptMode } from './prompt.js'
import { readSettings } from './settings.js'
import { registerTriggerHooks } from './trigger.js'
import { sessionTitleOf, sessionMetaOf } from './library.js'
import { openSession, resumeSession, modelOf, createAgent } from './session.js'
import { userMessage } from './session.js'
import { runTasksInParallel, watchWorkspace } from './dispatch.js'
import { seedBundledExperts } from './seed.js'
import { adoptWorkspace } from './adopt.js'
import { fillRoot, loadPrompts } from './session-prompts.js'
import { watchCategorySessions, backfillSessionLog, readSessionLog, findSessionFile, decodeZstdFrames } from './session-log.js'
import { loadTaxonomy } from './taxonomy.js'
import { MODEL_FILES, pickSource, downloadModel } from './model-source.js'
import { libraryModelDir, legacyModelDir } from './models.js'
import { busySessionIds, categorySessionId, isCategorySession, researchPrompt, markRunStarted, markRunEnded, readRuns, diagnoseRun, turnFinished, finishedAt, verifyResearch } from './research.js'
import { setGapDecision } from './settings.js'
import { fileURLToPath } from 'node:url'
import { resolveModelDir } from './models.js'
import { readFile } from 'node:fs/promises'

const PLUGIN_DIR = fileURLToPath(new URL('..', import.meta.url))

export const name = 'expert-role'
export const inject = ['skills', 'tools', 'webServer', 'agents', 'systemPrompt']

/**
 * 专家角色：把专家库根目录（默认 `~/AIExperts`，可用 `DSH_EXPERT_ROOT` 覆盖）下的专家目录注册成技能，
 * 提供尽调工作流工具（create/plan/record/status）与浏览器侧可视化接口。
 */
export function apply(ctx, config = {}) {
  const resolved = resolveDataDirSync()
  const root = config?.root ?? resolved.dir
  const library = new ExpertLibrary(root)
  const logger = ctx.logger?.('expert-role')
  let skillsControl

  // 资料目录一旦定位好，就把它放进左侧工作区；`create` 是幂等的，重启多少次都只会有一条。
  let workspaceAdopt = { ok: false, reason: 'pending' }
  const adoptLibraryWorkspace = async (attempt = 1) => {
    let controller
    try {
      controller = ctx.get('workspaceController')
    } catch (error) {
      controller = undefined
    }
    try {
      const result = await adoptWorkspace(controller, library.root)
      workspaceAdopt = result
      if (result.ok) {
        logger?.info?.(
          `[expert-role] 资料目录${result.created ? '已加进' : '本来就在'}左侧工作区：${result.title ?? library.root}`,
        )
      } else if (result.reason === 'no-service' && attempt < 3) {
        setTimeout(() => adoptLibraryWorkspace(attempt + 1).catch(() => {}), 4000)
        return
      } else {
        logger?.warn?.(`[expert-role] 没能把资料目录加进左侧工作区：${result.reason}`)
      }
    } catch (error) {
      workspaceAdopt = { ok: false, reason: String(error?.message ?? error) }
      logger?.warn?.(`[expert-role] 把资料目录加进左侧工作区失败：${error?.message ?? error}`)
    }
  }

  library
    .ensureRoot()
    .then(async () => {
      const settings = await readSettings(library.root)
      if (settings.adoptWorkspace === false) {
        workspaceAdopt = { ok: false, reason: 'disabled' }
        return
      }
      await adoptLibraryWorkspace()
    })
    .catch((error) => logger?.warn?.(`[expert-role] 初始化专家库失败：${error?.message ?? error}`))

  // 8 个大类会话是插件的辅助子智能体：每轮结束把结果收进历史，用户平时不用看。
  ctx.effect(() => watchCategorySessions(ctx, { root: library.root }), 'expert-role.session-log')

  // 历史为空时，把它们已经跑过的那几轮补进来（按会话+时间+字数去重，重复跑不会重复写）。
  const runBackfill = async () => {
    const existing = await readSessionLog(library.root, { limit: 1 })
    if (existing.length > 0) return { added: 0, skipped: true }
    return backfillSessionLog(process.env.DSH_HOME || dshHome(), library.root)
  }
  library
    .ensureRoot()
    .then(() => runBackfill())
    .then((result) => {
      if (result?.added) logger?.info?.(`[expert-role] 补进 ${result.added} 轮大类会话历史`)
    })
    .catch((error) => logger?.warn?.(`[expert-role] 补历史失败：${error?.message ?? error}`))

  // 首次启动把插件自带的专家（设计专家、插件专家）复制进资料库；已存在则一个文件都不碰。
  ctx.effect(() => {
    let disposed = false
    seedBundledExperts(library)
      .then((seeded) => {
        if (disposed || seeded.length === 0) return
        logger?.info?.(`[expert-role] 已放入自带专家：${seeded.join('、')}`)
        skillsControl?.invalidate?.()
      })
      .catch((error) => logger?.warn?.(`[expert-role] 放入自带专家失败：${error?.message ?? error}`))
    return () => {
      disposed = true
    }
  }, 'expert-role.seed')

  ctx.effect(
    () =>
      ctx.skills.registerProvider((control) => {
        skillsControl = control
        const provider = createExpertProvider(library)
        control?.signal?.addEventListener('abort', () => provider.dispose())
        return provider
      }),
    'expert-role.skills',
  )

  // 专家 → 本轮派发的开始时间。只在进程内有效，重启即清空。
  const dispatchRunning = new Map()

  // 资料级向量检索：懒加载（首次用到才读模型、算向量），
  // 之后每次查询只编码一次问句。缓存写到库根下 .cache，避免每次重启重算。
  let retrieverPromise = null
  const getRetriever = async () => {
    if (!retrieverPromise) {
      retrieverPromise = (async () => {
        const experts = await library.listExperts()
        return createRetriever({
          library,
          experts,
          cachePath: join(root, '.cache', 'docindex.json'),
          baseDir: resolveModelDir({ root, pluginDir: PLUGIN_DIR }).dir,
        })
      })().catch((error) => {
        retrieverPromise = null
        throw error
      })
    }
    return retrieverPromise
  }

  registerExpertTools(ctx, library, {
    invalidate: () => skillsControl?.invalidate?.(),
    // 不分专家、不打分到「哪位专家」，直接按资料相似度取前几份。
    retrieve: async (query, options = {}) => {
      const r = await getRetriever()
      return r.retrieve(query, { k: options.k ?? 5, useGroups: false })
    },
    // 第三档：插件直接开一个新会话并投递开场消息（宿主没有 agents 服务时由 openSession 返回原因）
    watchWorkspace: ({ expertId, sessionId }) =>
      watchWorkspace({ ctx, library, expertId, sessionId, outDir: join(root, expertId, 'workspace', 'out') }),
    // 同一个专家同时只许跑一轮派发：否则几个子会话会并发写同一份 survey，记录互相覆盖。
    runTasks: async (tasks, exec, expertId) => {
      const key = String(expertId || '')
      if (key && dispatchRunning.has(key)) {
        return { locked: true, runningSince: dispatchRunning.get(key) }
      }
      if (key) dispatchRunning.set(key, new Date().toISOString())
      try {
        return await runTasksInParallel(ctx, tasks, {
          model: modelOf(exec),
          cwd: root,
          timeoutMs: 600_000,
          concurrency: 4,
          parent: exec?.agent,
        })
      } finally {
        if (key) dispatchRunning.delete(key)
      }
    },
    // 工作区档复用同一个会话：活的直接续、进程重启过就接回，只有从没开过才新建。
    openWorkspace: async ({ expertId, cwd, kickoff, exec }) => {
      const model = modelOf(exec)
      const parent = exec?.agent
      let saved
      try {
        saved = (await library.readExpert(expertId))?.workspaceSessionId
      } catch {
        saved = undefined
      }
      if (saved) {
        const live = typeof ctx.agents?.get === 'function' ? ctx.agents.get(saved) : undefined
        if (live) {
          try {
            live.followup(userMessage(kickoff))
            return { sessionId: saved, reused: true }
          } catch {
            // 续不上就走接回流程
          }
        }
        const resumed = await resumeSession({ ctx, sessionId: saved, model, parent })
        if (resumed.sessionId) {
          try {
            resumed.agent.followup(userMessage(kickoff))
            return { sessionId: saved, reused: true }
          } catch (error) {
            logger?.warn?.(`[expert-role] 工作区会话投递失败：${error?.message ?? error}`)
          }
        }
      }
      // 号码写死：同一个专家永远是同一个会话号，重启后也按它找回，不再用时间戳现编。
      const opened = await openSession({
        ctx,
        cwd,
        kickoff,
        model,
        sessionId: workspaceSessionIdOf(expertId),
        parent,
      })
      if (opened.sessionId) {
        try {
          await library.setWorkspaceSession(expertId, opened.sessionId)
        } catch (error) {
          logger?.warn?.(`[expert-role] 记工作区会话失败：${error?.message ?? error}`)
        }
      }
      return { ...opened, reused: false }
    },
    openSession: ({ expertId, cwd, kickoff, exec }) =>
      openSession({
        ctx,
        cwd,
        kickoff,
        model: modelOf(exec),
        sessionId: `session-expert-${expertId}-${Date.now()}`,
        parent: exec?.agent,
      }),
  })

  ctx.effect(() => registerPrompt(ctx), 'expert-role.prompt')

  // 模式可能在面板里随时改，这里先读一次做初值，之后由 /api/settings 的 POST 更新。
  readSettings(root)
    .then((settings) => setPromptMode(settings.mode))
    .catch(() => {})

  registerTraceHooks(ctx, library)

  ctx.effect(() => registerTriggerHooks(ctx, library, { consultState }), 'expert-role.trigger')

  // 建八个大类会话：提示词来自 docs/session-prompts.md，不在这里另抄一份。
  const promptsDoc = fileURLToPath(new URL('../docs/session-prompts.md', import.meta.url))
  const bootstrapSessions = async (body) => {
    const { list, opening } = await loadPrompts(promptsDoc)
    if (!body || body.confirm !== true) {
      return { dryRun: true, count: list.length, list: list.map((item) => ({ title: item.title, chars: item.prompt.length })) }
    }
    const only = Array.isArray(body.only) ? new Set(body.only.map(String)) : null
    const model = body.model && body.model.provider && body.model.model
      ? { provider: String(body.model.provider), model: String(body.model.model) }
      : undefined
    const results = []
    for (const item of list) {
      if (only && !only.has(item.index)) continue
      const sessionId = `session-expert-cat-${item.index}`
      // 走宿主的会话命令：它会顺手把会话登记进工作区（agents.create 不会，左侧就看不见）。
      let created
      let controller
      try { controller = ctx.get('sessionController') } catch { controller = undefined }
      if (controller && typeof controller.create === 'function' && workspaceAdopt?.id) {
        try {
          await controller.create({ workspaceId: workspaceAdopt.id, sessionId })
          const agent = typeof ctx.agents?.get === 'function' ? ctx.agents.get(sessionId) : undefined
          created = agent ? { sessionId, agent } : { sessionId, error: '会话建好了但拿不到 agent' }
        } catch (error) {
          created = { sessionId: null, error: `建会话失败：${error?.message ?? error}` }
        }
      } else {
        created = await createAgent({ ctx, cwd: library.root, model, sessionId })
      }
      if (created.error) {
        results.push({ title: item.title, error: created.error })
        continue
      }
      try {
        const head = fillRoot(item.prompt, library.root)
        const tail = fillRoot(opening, library.root)
        created.agent.followup(userMessage(tail ? `${head}\n\n${tail}` : head))
        results.push({ title: item.title, sessionId: created.sessionId })
      } catch (error) {
        results.push({ title: item.title, sessionId: created.sessionId, error: `开场消息没投递进去：${error?.message ?? error}` })
      }
    }
    return { dryRun: false, created: results }
  }

  // 给已经建好的 8 个大类会话补一句话（比如新增的回话标记规矩）。
  async function notifyCategorySessions(body = {}) {
    const text = fillRoot(String(
      body.text ??
        '补一条规矩：以后每轮回话的最后另起一行，按情况写一个固定标记——不用我管就写【不用你看】；要我拍板就写【要你看·花额度】/【要你看·改别类】/【要你看·新建专家】，后面跟一句为什么。除这三种不要写。这条只影响回话结尾，别的都不改。',
    ), library.root).trim()
    const only = Array.isArray(body.only) && body.only.length ? body.only : null
    const model = body.model ?? undefined
    const ids = Array.from({ length: 8 }, (_, i) => `session-expert-cat-${String(i + 1).padStart(2, '0')}`)
      .filter((id) => !only || only.some((n) => id.endsWith(String(n).padStart(2, '0'))))
    if (body.confirm !== true) return { dryRun: true, ids, text }
    // 会话正在跑缺口调研时不能再塞消息：会把那一轮挤掉。除非显式 force。
    const runs = await readRuns(library.root)
    const busy = busySessionIds(runs)
    const results = []
    for (const sessionId of ids) {
      if (busy.has(sessionId) && body.force !== true) {
        results.push({ sessionId, skipped: 'busy', reason: '这一类的调研正在跑，先不发' })
        continue
      }
      const started = Date.now()
      // 会话可能已经由宿主挂在内存里（正在被持有写句柄），这时直接用它，别再 resume。
      let agent = undefined
      try {
        agent = typeof ctx.agents?.get === 'function' ? ctx.agents.get(sessionId) : undefined
      } catch {
        agent = undefined
      }
      if (!agent || typeof agent.followup !== 'function') {
        const resumed = await resumeSession({ ctx, sessionId, model })
        if (resumed.error) {
          results.push({ sessionId, error: resumed.error })
          continue
        }
        agent = resumed.agent
      }
      let resolveDone
      const done = new Promise((resolve) => {
        resolveDone = resolve
      })
      const offStop = ctx.on('agent/turn-stopping', ({ agent }) => {
        if (agent?.id === sessionId) resolveDone('done')
      })
      try {
        agent.followup(userMessage(text))
        const timer = new Promise((resolve) => setTimeout(() => resolve('timeout'), 240000))
        const outcome = await Promise.race([done, timer])
        results.push(
          outcome === 'timeout'
            ? { sessionId, error: '超时（240 秒）' }
            : { sessionId, ok: true, ms: Date.now() - started },
        )
      } catch (error) {
        results.push({ sessionId, error: `投递失败：${error?.message ?? error}` })
      } finally {
        offStop?.()
      }
    }
    return { dryRun: false, results }
  }

  // 向量模型：本机没有时按「国外源 → 镜像（过速）→ COS」拉一份到库根的 models/ 下。
  let modelJob = { status: 'idle', got: 0, total: 0, source: '', error: '', updatedAt: 0 }

  const modelStateOf = async () => {
    const resolved = resolveModelDir({ root: library.root, pluginDir: PLUGIN_DIR })
    return {
      installed: resolved.source !== 'none',
      dir: libraryModelDir(library.root),
      legacyDir: legacyModelDir(PLUGIN_DIR),
      source: resolved.source,
      job: modelJob,
      files: MODEL_FILES.map((item) => item.name),
    }
  }

  const startModelDownload = async () => {
    if (modelJob.status === 'downloading' || modelJob.status === 'picking') {
      return { ok: false, reason: 'busy', job: modelJob }
    }
    modelJob = { status: 'picking', got: 0, total: 0, source: '', error: '', updatedAt: Date.now() }
    const picked = await pickSource().catch((error) => ({ source: null, tried: [], error: String(error?.message ?? error) }))
    if (!picked.source) {
      modelJob = { ...modelJob, status: 'failed', error: '三个源都不通；请手动下载或先开代理', updatedAt: Date.now() }
      return { ok: false, reason: 'no-source', tried: picked.tried, job: modelJob }
    }
    const dir = libraryModelDir(library.root)
    modelJob = { status: 'downloading', got: 0, total: MODEL_FILES.reduce((sum, f) => sum + f.size, 0), source: picked.source.id, error: '', updatedAt: Date.now() }
    try {
      await downloadModel({
        dir,
        source: picked.source,
        onProgress: ({ got }) => {
          modelJob = { ...modelJob, got: modelJob.got + 0, status: 'downloading', updatedAt: Date.now(), current: got }
        },
      })
      modelJob = { ...modelJob, status: 'done', got: modelJob.total, updatedAt: Date.now() }
      retrieverPromise = null // 装好后下一次检索就切到向量模式
      return { ok: true, source: picked.source.id, dir, job: modelJob }
    } catch (error) {
      modelJob = { ...modelJob, status: 'failed', error: String(error?.message ?? error), updatedAt: Date.now() }
      return { ok: false, reason: 'download-failed', error: modelJob.error, job: modelJob }
    }
  }

  // 「同意去查」之后把任务投进该大类已有的会话（不新建），跑完由那个会话写回资料库。
  const startGapResearch = async (body = {}) => {
    const expert = String(body?.expert ?? '').trim()
    const key = String(body?.key ?? '').trim()
    if (!expert || !key) return { error: '缺少 expert 或 key 参数' }
    const expertDir = library.expertDir(expert)
    const topic = String(body?.topic ?? key).trim()

    // 只投进这个大类已有的会话：不新建任何会话。
    const taxonomy = await loadTaxonomy(library.root)
    const groups = Array.isArray(taxonomy?.groups) ? taxonomy.groups : []
    const info = await library.readExpert(expert).catch(() => null)
    const level1 = String(info?.level1 ?? '').trim()
    const groupIndex = groups.findIndex((item) => String(item?.title ?? '').trim() === level1)
    const sessionId = categorySessionId(groupIndex + 1)
    if (!sessionId) {
      return { error: `「${expert}」没有归到八个大类里，找不到要投的会话` }
    }

    // 同一个大类同时只跑一条，免得两个任务在一个会话里互相踩。
    const running = (await readRuns(library.root)).filter((run) => run?.sessionId === sessionId && run?.status === 'running')
    if (running.length) {
      return { error: `这一类正在查「${running[0].topic ?? running[0].key ?? '另一条'}」，等它跑完再点` }
    }

    await setGapDecision(library.root, expert, key, 'research')
    await markRunStarted(library.root, { sessionId, expert, key, topic, startedAt: new Date().toISOString() })

    const prompt = researchPrompt({ expertId: expert, expertDir, topic, key })
    const model = body?.model ?? undefined
    try {
      let agent
      if (typeof ctx.agents?.get === 'function') agent = ctx.agents.get(sessionId)
      if (!agent && typeof resumeSession === 'function') {
        const resumed = await resumeSession({ ctx, sessionId, model })
        if (!resumed?.error) agent = resumed?.agent
      }
      if (!agent || typeof agent.followup !== 'function') {
        throw new Error('这一类的会话当前没开：先在左侧点开它一次，再回这里点「同意去查」')
      }
      agent.followup(userMessage(prompt))
      return { ok: true, sessionId, expert, key, topic }
    } catch (error) {
      const message = `${error?.message ?? error}`
      await markRunEnded(library.root, { sessionId, expert, key, status: 'failed', error: message })
      return { error: message, sessionId }
    }
  }

  // 列运行记录时顺手诊断：是卡在工具上、在等你、原地打转，还是根本没人在跑。
  const researchRuns = async () => {
    const runs = await readRuns(library.root)
    const home = process.env.DSH_HOME || dshHome()
    const out = []
    for (const run of runs) {
      if (run?.status !== 'running') {
        // 已经收尾但还没核对过（老记录 / 自愈路径）：补一次「补了几份、登记齐没齐」。
        if (run?.status === 'done' && !run?.verifiedAt && run?.expert && run?.startedAt) {
          try {
            const verified = await verifyResearch({
              expertDir: library.expertDir(run.expert),
              startedAt: run.startedAt,
              endedAt: run.endedAt,
            })
            await markRunEnded(library.root, {
              sessionId: run.sessionId,
              expert: run.expert,
              key: run.key,
              status: 'done',
              files: verified.files ?? [],
              added: verified.added ?? 0,
              registered: verified.registered === true,
              verifiedAt: new Date().toISOString(),
            })
            out.push({
              ...run,
              files: verified.files ?? [],
              added: verified.added ?? 0,
              registered: verified.registered === true,
              verifiedAt: new Date().toISOString(),
            })
            continue
          } catch {
            out.push(run)
            continue
          }
        }
        out.push(run)
        continue
      }
      let live = true
      try {
        live = Boolean(ctx.agents?.get?.(run.sessionId))
      } catch {
        live = true
      }
      let events = []
      try {
        const file = await findSessionFile(home, run.sessionId)
        if (file) {
          const text = decodeZstdFrames(await readFile(file))
          events = text
            .split('\n')
            .filter(Boolean)
            .map((line) => {
              try {
                return JSON.parse(line)
              } catch {
                return null
              }
            })
            .filter(Boolean)
        }
      } catch {
        events = []
      }
      const diagnosis = diagnoseRun(events, { now: Date.now(), live })
      // 会话其实已经收尾（turn/end），但结束事件没收到：这里自愈，别让它永远「正在查」。
      if (diagnosis.code === 'running' && turnFinished(events)) {
        const endedAt = finishedAt(events)
        let verified = { added: 0, files: [], registered: false }
        try {
          verified = await verifyResearch({ expertDir: library.expertDir(run.expert), startedAt: run.startedAt, endedAt: run.endedAt })
        } catch {
          verified = { added: 0, files: [], registered: false }
        }
        await markRunEnded(library.root, {
          sessionId: run.sessionId,
          expert: run.expert,
          key: run.key,
          status: 'done',
          files: verified.files ?? [],
          added: verified.added ?? 0,
          registered: verified.registered === true,
          verifiedAt: new Date().toISOString(),
        })
        out.push({
          ...run,
          status: 'done',
          endedAt,
          added: verified.added ?? 0,
          registered: verified.registered === true,
          files: verified.files ?? [],
          diagnosis: { code: 'done', text: '已收尾' },
        })
        continue
      }
      out.push({ ...run, diagnosis })
    }
    return out
  }

  const cancelGapResearch = async (body = {}) => {
    const expert = String(body?.expert ?? '').trim()
    const key = String(body?.key ?? '').trim()
    const sessionId = String(body?.sessionId ?? '').trim()
    if (!expert && !key && !sessionId) return { error: '缺少 expert/key 或 sessionId' }
    const status = 'failed'
    await markRunEnded(library.root, {
      sessionId,
      expert,
      key,
      status,
      error: String(body?.reason ?? '已手动标记失败'),
    })
    return { ok: true, sessionId, expert, key, status }
  }

  const gapResearchRoutes = { startGapResearch, researchRuns, cancelGapResearch }

  // 缺口会话跑完就落一条结束记录，面板上「正在查」才会停。
  ctx.effect(() => {
    const off = ctx.on('agent/turn-stopping', async ({ agent } = {}) => {
      const sessionId = String(agent?.id ?? agent?.session?.id ?? '')
      if (!sessionId || !isCategorySession(sessionId)) return
      try {
        // 先看磁盘再收尾：这次写了几份、登记齐没齐，记进运行记录。
        const running = (await readRuns(library.root)).find((run) => run?.sessionId === sessionId && run?.status === 'running')
        let verified = { added: 0, files: [], registered: false }
        if (running?.expert) {
          verified = await verifyResearch({ expertDir: library.expertDir(running.expert), startedAt: running.startedAt, endedAt: new Date().toISOString() })
        }
        await markRunEnded(library.root, { sessionId, expert: running?.expert, key: running?.key, status: 'done', files: verified.files ?? [], added: verified.added ?? 0, registered: verified.registered === true, verifiedAt: new Date().toISOString() })
      } catch {
        // 记不上不影响会话本身
      }
    })
    return () => off?.()
  }, 'expert-role.gap-research')

  ctx.effect(
    () =>
      createRoutes(library, {
        sessionTitle: sessionTitleOf,
        sessionMeta: sessionMetaOf,
        onSettingsChange: (settings) => setPromptMode(settings.mode),
        runningExperts: () => new Map(dispatchRunning),
        workspaceAdopt: () => workspaceAdopt,
        bootstrapSessions,
        backfillSessionLog: () => backfillSessionLog(process.env.DSH_HOME || dshHome(), library.root),
        notifySessions: notifyCategorySessions,
        modelState: modelStateOf,
        startModelDownload,
        ...gapResearchRoutes,
      }).map((route) => ctx.webServer.register(route)),
    'expert-role.routes',
  )

  logger?.info?.(`[expert-role] 专家库根目录 ${library.root}`)
}
