import { computeStats } from './stats.js'
import { isResearchSession } from './library.js'
import { gapOf } from './gap.js'
import { issuesOf } from './validate.js'
import {
  MODES, MODE_LABELS, RESEARCH, RESEARCH_LABELS, LANGS, GAP_OPTIONS,
  GAP_ACTIONS, GAP_ACTION_LABELS, readSettings, writeSettings, setGapDecision,
} from './settings.js'
import { topicsOf, autoDecideFor, matchLibrary } from './topics.js'
import { loadTaxonomy, groupExperts } from './taxonomy.js'
import { keywordHit, rowsOf } from './trigger.js'
import { addPending, listPending, finishPending } from './pending.js'
import { readRetrieval, summarizeRetrieval, RISK_LABELS, THRESHOLDS } from './audit.js'
import { readSessionLog } from './session-log.js'
import { dataDirStatus, listCandidates, migrateDataDir, setDataDir, resetDataDir } from './datadir.js'

const LOCAL_HOSTS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

function isLocal(req) {
  const address = req?.socket?.remoteAddress ?? ''
  return LOCAL_HOSTS.has(address)
}

function sendJson(res, code, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(body)
}

function query(req) {
  try {
    return new URL(req.url ?? '/', 'http://127.0.0.1').searchParams
  } catch {
    return new URLSearchParams()
  }
}

/** 读 POST 的小 JSON 体（面板切换模式用，限 64KB）。 */
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > 65_536) {
        reject(new Error('请求体太大'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (chunks.length === 0) return resolve({})
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch (error) {
        reject(new Error(`请求体不是合法 JSON：${error?.message ?? error}`))
      }
    })
    req.on('error', reject)
  })
}

/** 浏览器半侧用的只读 HTTP 接口。 */
export function createRoutes(library, options = {}) {
  // 宿主的准入服务：挡掉「浏览器网页调本机接口」这一类请求。
  // 没有这个守卫时退回原来的本机判断（旧宿主）。
  const hostAllows = typeof options.isAllowed === 'function' ? options.isAllowed : () => true
  const route = (path, handle) => ({
    kind: 'exact',
    path,
    handler: async (req, res) => {
      if (!isLocal(req)) return sendJson(res, 403, { error: 'local only' })
      let allowed = true
      try {
        allowed = hostAllows(req) !== false
      } catch {
        allowed = true
      }
      if (!allowed) return sendJson(res, 403, { error: 'forbidden' })
      try {
        const payload = await handle(req)
        sendJson(res, 200, payload)
      } catch (error) {
        sendJson(res, 400, { error: String(error?.message ?? error) })
      }
    },
  })

  return [
    route('/expert-role/api/experts', async () => {
      const trace = await library.traceTail(5000)
      const running = options.runningExperts ? options.runningExperts() : new Map()
      const settings = await readSettings(library.root)
      const decisions = settings.gapDecisions ?? {}
      const pending = await listPending(library.root, 'queued')
      const rows = await rowsOf(library)
      const expertsAll = await library.listExperts()
      const taxonomy = await loadTaxonomy(library.root)
      return {
      root: library.root,
      taxonomy: groupExperts(expertsAll, taxonomy),
      routers: (await library.listExperts()).filter((expert) => expert.role === 'router').map((expert) => ({ id: expert.id, title: expert.title, description: expert.description })),
      experts: await Promise.all((await library.listExperts()).filter((expert) => expert.role !== 'router').map(async (expert) => ({
        id: expert.id,
        title: expert.title,
        description: expert.description,
        level1: expert.level1 || '',
        level2: expert.level2 || '',
        status: expert.status,
        stage: expert.stage,
        stars: expert.stars,
        stageHint: expert.stageHint,
        maturity: expert.maturity ?? null,
        mode: expert.mode,
        skillName: expert.skillName,
        updatedAt: expert.updatedAt,
        goal: expert.survey.goal,
        steps: expert.survey.steps,
        records: expert.survey.records.slice(-5),
        topics: expert.topics ?? [],
        titles: expert.titles ?? {},
        gap: gapOf(expert, trace),
        // 缺口按主题并起来，每个主题带用户已做的处置（回收 / 去查 / 不用补）。
        // 缺口主题由插件自己判定处置：更对口的转交、已有相近主题的回收、其余才需要授权去查。
        gapTopics: topicsOf(trace, expert.id).map((item) => ({
          ...item,
          decision: decisions?.[expert.id]?.[item.key] ?? null,
          auto: autoDecideFor(item, expert, rows, keywordHit(item.title, rows), matchLibrary(item.title, expert)),
          needsApproval: (() => {
            const auto = autoDecideFor(item, expert, rows, keywordHit(item.title, rows))
            return auto.action === 'research' && settings.fillMode === 'ask'
          })(),
        })),
        // 正在派发调研的专家带上开始时间，面板据此显示「已跑 N 分 N 秒」。
        runningSince: running.get(expert.id) ?? null,
        // 只标不拦：清单与磁盘对不上的地方，列在面板上让人自己决定要不要修。
        issues: expert.hasSkill || (expert.topics ?? []).length > 0 ? await issuesOf(library, expert) : { issues: [], counts: {} },
      }))),
      }
    }),

    route('/expert-role/api/files', async (req) => {
      const expert = query(req).get('expert')
      if (!expert) throw new Error('缺少 expert 参数')
      return { expert, files: await library.listFiles(expert) }
    }),

    route('/expert-role/api/file', async (req) => {
      const path = query(req).get('path')
      if (!path) throw new Error('缺少 path 参数')
      const content = await library.readText(path)
      return { path, content: content.slice(0, 200_000) }
    }),

    route('/expert-role/api/stats', async (req) => {
      const params = query(req)
      const days = Number(params.get('days') ?? 30) || 30
      const expert = params.get('expert') ?? undefined
      return computeStats(library, { days, expert: expert || undefined })
    }),

    route('/expert-role/api/bootstrap-sessions', async (req) => {
      if (!options.bootstrapSessions) throw new Error('当前宿主不支持建会话')
      const body = (await readBody(req)) ?? {}
      return options.bootstrapSessions(body)
    }),

    route('/expert-role/api/model-state', async () => ({
      ...(await options.modelState?.()),
    })),

    route('/expert-role/api/model-download', async (req) => {
      if (req.method !== 'POST') return { error: '只支持 POST' }
      const started = await options.startModelDownload?.()
      return started ?? { error: '下载不可用' }
    }, { merge: false }),

    route('/expert-role/api/data-dir', async (req) => {
      const method = (req.method ?? 'GET').toUpperCase()
      if (method !== 'POST') {
        return {
          ...(await dataDirStatus({ activeDir: library.root })),
          candidates: await listCandidates({ activeDir: library.root }),
          workspace: options.workspaceAdopt?.(),
          sessions: options.sessionRepair?.(),
        }
      }
      const body = await readBody(req)
      const target = String(body?.directory ?? '')
      const result = body?.migrate
        ? await migrateDataDir(target, { from: library.root, deleteOld: Boolean(body?.deleteOld) })
        : await setDataDir(target, { copy: Boolean(body?.copy), from: library.root })
      return {
        ...result,
        ...(await dataDirStatus({ activeDir: library.root })),
        candidates: await listCandidates({ activeDir: library.root }),
        workspace: options.workspaceAdopt?.(),
      }
    }),

    route('/expert-role/api/data-dir/reset', async (req) => {
      if ((req.method ?? 'GET').toUpperCase() !== 'POST') throw new Error('只接受 POST')
      const result = await resetDataDir()
      return { ...result, ...(await dataDirStatus({ activeDir: library.root })) }
    }),

    route('/expert-role/api/settings', async (req) => {
      if ((req.method ?? 'GET').toUpperCase() !== 'POST') {
        const settings = await readSettings(library.root)
        return { ...settings, modes: MODES, labels: MODE_LABELS, researchModes: RESEARCH, researchLabels: RESEARCH_LABELS, langs: LANGS, gapOptions: GAP_OPTIONS }
      }
      const body = await readBody(req)
      const patch = {}
      if (body?.mode) patch.mode = body.mode
      if (body?.research) patch.research = body.research
      if (body?.lang) patch.lang = body.lang
      if (body?.gap !== undefined) patch.gap = Number(body.gap)
      if (typeof body?.adoptWorkspace === 'boolean') patch.adoptWorkspace = body.adoptWorkspace
      const next = await writeSettings(library.root, patch)
      options.onSettingsChange?.(next)
      return { ...next, modes: MODES, labels: MODE_LABELS, researchModes: RESEARCH, researchLabels: RESEARCH_LABELS, langs: LANGS, gapOptions: GAP_OPTIONS }
    }),

    route('/expert-role/api/gap-decision', async (req) => {
      if ((req.method ?? 'GET').toUpperCase() !== 'POST') throw new Error('只接受 POST')
      const body = await readBody(req)
      const expert = String(body?.expert ?? '').trim()
      const key = String(body?.key ?? '').trim()
      const action = body?.action === null ? null : String(body?.action ?? '').trim()
      if (!expert || !key) throw new Error('缺少 expert 或 key 参数')
      const next = await setGapDecision(library.root, expert, key, action || null)
      options.onSettingsChange?.(next)
      return { ...next, actions: GAP_ACTIONS, actionLabels: GAP_ACTION_LABELS }
    }),

    route('/expert-role/api/gap-research', async (req) => {
      if ((req.method ?? 'GET').toUpperCase() === 'POST') {
        const body = await readBody(req)
        if (!options.startGapResearch) return { error: '宿主没有提供调研能力' }
        return options.startGapResearch(body)
      }
      const runs = options.researchRuns ? await options.researchRuns() : []
      return { root: library.root, runs }
    }),

    route('/expert-role/api/gap-research/cancel', async (req) => {
      if ((req.method ?? 'GET').toUpperCase() !== 'POST') throw new Error('只接受 POST')
      const body = await readBody(req)
      if (!options.cancelGapResearch) return { error: '宿主没有提供取消能力' }
      return options.cancelGapResearch(body)
    }),

    route('/expert-role/api/retrieval', async (req) => {
      const limit = Math.min(500, Math.max(1, Number(query(req).get('limit') ?? 200) || 200))
      const rows = await readRetrieval(library.root, limit)
      return { root: library.root, rows, summary: summarizeRetrieval(rows), labels: RISK_LABELS, thresholds: THRESHOLDS }
    }),

    route('/expert-role/api/sessions/notify', async (req) => {
      const body = req.method === 'POST' ? await readBody(req) : {}
      if (!options.notifySessions) return { error: '宿主没有提供补话能力' }
      return options.notifySessions(body)
    }),
    route('/expert-role/api/session-log/backfill', async () => {
      return options.backfillSessionLog?.() ?? { added: 0, skipped: true }
    }),
    route('/expert-role/api/session-log', async (req) => {
      const limit = Math.min(500, Math.max(1, Number(query(req).get('limit') ?? 200) || 200))
      return { entries: await readSessionLog(library.root, { limit }) }
    }),

    route('/expert-role/api/trace', async (req) => {
      const limit = Math.min(500, Math.max(1, Number(query(req).get('limit') ?? 200) || 200))
      // 用户 2026-11-16 定：调研子会话与工作区是造资料的人，不出现在使用记录里
      const entries = (await library.traceTail(limit)).filter((entry) => !isResearchSession(entry.session))
      const resolve = options.sessionMeta ?? options.sessionTitle
      if (typeof resolve !== 'function') return { root: library.root, entries }
      const full = typeof options.sessionMeta === 'function'
      const seen = new Map()
      const metaOf = async (id) => {
        if (!seen.has(id)) {
          const meta = full ? await resolve(id) : { title: await resolve(id) }
          seen.set(id, meta)
        }
        return seen.get(id)
      }
      const withTitles = await Promise.all(
        entries.map(async (entry) => {
          if (!entry.session) return entry
          const meta = await metaOf(entry.session)
          return {
            ...entry,
            sessionTitle: meta.title,
            sessionSubagentLabel: meta.subagentLabel || '',
            sessionParentTitle: meta.parentTitle || '',
            sessionParentId: meta.parentId || '',
          }
        }),
      )
      return { root: library.root, entries: withTitles }
    }),
  ]
}
