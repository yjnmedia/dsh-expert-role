import { readSettings } from './settings.js'
import { rhythmGuide } from './guidance.js'
import { missGuidance } from './guidance.js'
import { rowsOf, keywordHit } from './trigger.js'
import { sourcesOf, renderSources, LEVEL_LABELS } from './sources.js'
import { join } from 'node:path'
import { renderSurvey, renderManifest, slugify, parseFrontmatter, ExpertLibrary, MISSING_GUIDE } from './library.js'
import { ingestSource } from './ingest.js'
import { recordRetrieval, recordRetrievalFailure } from './audit.js'

const textValueSchema = {
  type: 'object',
  properties: { text: { type: 'string' }, expert: { type: 'string' }, count: { type: 'number' } },
  required: ['text'],
  additionalProperties: false,
}

const findValueSchema = {
  type: 'object',
  properties: {
    text: { type: 'string' },
    count: { type: 'number' },
    missing: { type: 'boolean' },
  },
  required: ['text', 'missing'],
  additionalProperties: false,
}

/** 关键词切成词：中文整段、英文小写、按空白和标点断开。 */
function tokenize(query) {
  return String(query ?? '')
    .toLowerCase()
    .split(/[\s,，、/|·:：;；]+/)
    .filter((token) => token.length > 0)
}

function matchesAny(hay, tokens) {
  const text = String(hay ?? '').toLowerCase()
  return tokens.some((token) => text.includes(token))
}

const objectSchema = (properties, required = []) => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
})

const MODES = ['parallel', 'serial', 'workspace']

async function recordMiss(library, expertId, query) {
  try {
    await library.appendTrace({ ts: new Date().toISOString(), kind: 'miss', expert: expertId || '', query: String(query ?? '').slice(0, 120) })
  } catch {
    /* 记账失败不影响查询 */
  }
}

async function handoffHint(library, expertId, query) {
  if (!expertId) return null
  try {
    const rows = await rowsOf(library)
    const hit = keywordHit(String(query ?? ''), rows.filter((row) => row.expertId !== expertId))
    if (!hit) return null
    const target = await library.readExpert(hit.expertId)
    await library.appendTrace({
      ts: new Date().toISOString(),
      kind: 'handoff',
      expert: expertId,
      target: hit.expertId,
      query: String(query ?? '').slice(0, 120),
    })
    return {
      target: hit.expertId,
      text: `这个问题看起来不归「${expertId}」管，更像「${target.title}」（${hit.expertId}）的事。正确做法：先调 lookup_expert_knowledge({ expert: "${hit.expertId}", query }) 用那边资料回答；如果那边也没有，再回来问用户。不要自己凭记忆编，也不要在本专家这里新建资料。`,
    }
  } catch {
    return null
  }
}

function queryExpert(args) {
  return typeof args?.expert === 'string' && args.expert ? args.expert : ''
}

function renderText(args, value) {
  return [{ type: 'text', text: String(value?.text ?? '') }]
}

function assertExpertId(id) {
  if (typeof id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(id)) {
    throw new Error(`专家 id 必须是小写字母/数字/连字符：${id}`)
  }
  return id
}

function cell(value) {
  return String(value ?? '').replace(/\|/g, '/').replace(/\r?\n/g, ' ').trim()
}

async function regenerateIndex(library) {
  const experts = await library.listExperts()
  const lines = ['# 专家库索引', '', `根目录：${library.root}`, '']
  lines.push('| 专家 | 标题 | 阶段 | 星级 | 分数 | 卡在哪 | 模式 | 更新 |', '|---|---|---|---|---|---|---|---|')
  for (const expert of experts) {
    lines.push(
      `| ${expert.id} | ${cell(expert.title)} | ${expert.stage} | ${expert.stars} | ${expert.maturity?.score ?? ''} | ${cell(expert.maturity?.blockers?.join('；') ?? '')} | ${expert.mode} | ${cell(expert.updatedAt)} |`,
    )
  }
  lines.push('')
  await library.writeText('index.md', lines.join('\n'))
  return experts
}

/** 从工具执行上下文里取会话 id；取不到就不写这个字段。 */
/** 是不是插件自己派发的调研子会话：它只输出结论，不该自己记进度、也不该再开工作区。 */
export function isDispatchChild(exec) {
  return String(sessionIdOf(exec) ?? '').startsWith('session-expert-task-')
}

/**
 * 判定子会话的正文是不是「其实没干成」。
 * 子会话没有读写工具时不会报错，只会写一段「我没有工具 / 做不了」，
 * 以前这种也记 done，进度就成了假的。
 */
export function looksUnfinished(text) {
  const value = String(text ?? '').trim()
  if (value.length < 40) return true
  return /没有(文件)?(读写|读文件|写入)?工具|没有读写|无法读取|读不了|写不了|做不了|没法(做|读|写)|工具.{0,6}(缺失|不可用)|blocked/i.test(value)
}

export function sessionIdOf(exec) {
  const id = exec?.agent?.session?.id ?? exec?.session?.id ?? exec?.sessionId ?? exec?.agent?.sessionId
  return typeof id === 'string' && id.length > 0 ? id : undefined
}

/**
 * 专家名规范（用户 2026-11-18 定）：最多 6 个字，两个字的自动补「专家」；名字要能对上受控词表的锚点。
 * 例：AI 生图 → 图像生成专家；界面与交互 → 界面交互专家；阅读器 → 阅读器专家。
 */
export function normalizeExpertTitle(input) {
  const raw = String(input ?? '').trim()
  if (!raw) throw new Error('专家名不能为空：给一个 2–6 个字的名字，例如「图像生成专家」')
  const chars = Array.from(raw.replace(/\s+/g, ''))
  if (chars.length > 6) {
    throw new Error(`专家名最多 6 个字：现在「${raw}」是 ${chars.length} 个字，缩短到 6 个字以内`)
  }
  if (chars.length <= 3 && !raw.endsWith('专家')) return `${raw}专家`
  return raw
}

export function createToolDefinitions(library, hooks = {}) {
  const trace = (entry, exec) => {
    const session = sessionIdOf(exec)
    return library.appendTrace(session ? { ...entry, session } : entry).catch(() => {})
  }
  const changed = () => {
    try {
      hooks.invalidate?.()
    } catch {
      /* 目录刷新失败不影响写入结果 */
    }
  }

  return [
    {
      name: 'expert_list',
      description: '列出本机专家库里的所有领域专家，含阶段（起步/可用/可靠/权威）、星级、分数、卡在哪一维、模式与调研进度。',
      parameters: objectSchema({}),
      output: { schema: textValueSchema, render: renderText },
      async execute() {
        const experts = await library.listExperts()
        if (experts.length === 0) {
          return { text: `专家库为空（${library.root}）。用 expert_create 新建一个专家。`, count: 0 }
        }
        const rows = experts.map((expert) => {
          const done = expert.survey.steps.filter((step) => step.done).length
          const total = expert.survey.steps.length
          return `${expert.id}\t${expert.stage}\t${expert.stars}\t${expert.maturity?.score ?? ''}\t${expert.mode}\t${done}/${total}\t${expert.title}\t${expert.maturity?.blockers?.join('；') ?? ''}`
        })
        const selfTests = experts.filter((expert) => expert.maturity?.queries)
        const tail = selfTests.length ? ['', ...selfTests.map((expert) => `${expert.id}：${expert.maturity.queries.text}`)] : []
        return { text: [`专家库：${library.root}`, 'id\t阶段\t星级\t分数\t模式\t步骤\t标题\t卡在哪', ...rows, ...tail].join('\n'), count: experts.length }
      },
    },

    {
      name: 'expert_create',
      description: '在专家库里新建一个领域专家目录，生成 SKILL.md 与 manifest.json，并更新 index.md。已存在则不覆盖，只返回现状。',
      parameters: objectSchema(
        {
          id: { type: 'string', description: '专家 id，小写字母/数字/连字符，例如 ai-image' },
          title: { type: 'string', description: '中文标题，例如 AI 生图' },
          description: { type: 'string', description: '一句话说明这个专家管什么，会进技能目录' },
          whenToUse: { type: 'string', description: '什么时候该加载它（可选）' },
          skill: { type: 'boolean', description: '是否注册成独立技能（默认 false，只做资料目录；true 用于总入口这类需要被模型直接发现的专家）' },
        },
        ['id', 'title', 'description'],
      ),
      output: { schema: textValueSchema, render: renderText },
      async execute(args, exec) {
        const id = assertExpertId(slugify(args.id))
        // 工具入参对象可能被宿主冻结，不能改写 args（2026-11-18 修：直接赋值会抛 Cannot assign to read only property）
        const title = normalizeExpertTitle(args.title)
        await library.ensureRoot()
        const dir = library.expertDir(id)
        const skillPath = join(dir, 'SKILL.md')
        const exists = await library.readText(join(library.expertRel(id), 'SKILL.md')).then(() => true).catch(() => false)
        if (exists) {
          const expert = await library.readExpert(id)
          return { text: `专家 ${id} 已存在（${expert.title}，${expert.stage} ${expert.stars}），未覆盖。`, expert: id }
        }
        const frontmatter = [
          '---',
          `name: expert-${id}`,
          `description: ${args.description.replace(/\r?\n/g, ' ')}`,
          ...(args.whenToUse ? [`when-to-use: ${args.whenToUse.replace(/\r?\n/g, ' ')}`] : []),
          '---',
          '',
          `# ${title}`,
          '',
          '## 先读这里',
          '',
          '- `references/`：分主题的资料文件，按需读取，不要整目录灌进上下文。',
          '- `survey.md`：尽调计划与进度，续跑前先读它。',
          '',
          '## 使用方式',
          '',
          '1. 先读 `references/index.md`（若有）确定要查哪几份。',
          '1b. 库里若有 `references/queries.md`，那是「常见问题怎么找」的自测表，可据此判断覆盖够不够。',
          '2. 只读与当前问题相关的文件，读完在回复里标注来源文件名。',
          '3. 拿不到结论时说明缺什么资料，不要编造。',
          '',
          MISSING_GUIDE,
          '',
        ].join('\n')
        await library.writeText(join(library.expertRel(id), 'SKILL.md'), frontmatter)
        await library.writeText(join(library.expertRel(id), 'references', 'index.md'), `# ${title} · 资料索引\n\n| 文件 | 管什么 |\n|---|---|\n`)
        await library.writeText(
          join(library.expertRel(id), 'references', 'queries.md'),
          [
            `# ${title} · 常见问题自测`,
            '',
            '把用户真会问的话写进来（8–12 条），插件会跑一遍看能不能找到对应资料。',
            '',
            '| 用户会怎么问 | 该命中哪份 | 要点 | 上次自测 |',
            '| --- | --- | --- | --- |',
            '| （替换成第一条真实问法） | （资料目录名） | （必须能答出来的要点） |  |',
            '',
          ].join('\n'),
        )
        await library.writeJson(join(library.expertRel(id), 'manifest.json'), renderManifest({
          id,
          title,
          description: args.description,
          mode: 'serial',
          status: 'draft',
          expose: args.skill === true ? 'skill' : 'none',
        }))
        await regenerateIndex(library)
        await trace({ kind: 'write', expert: id, path: `${id}/SKILL.md` }, exec)
        changed()
        return { text: `已创建专家 ${id}（${title}${args.skill === true ? '，已注册为技能' : '，只做资料目录'}）：\n- ${skillPath}\n- ${join(dir, 'survey.md')}（尚未生成）\n- ${join(dir, 'references', 'index.md')}`, expert: id }
      },
    },

    {
      name: 'expert_plan',
      description: '为某个专家写尽调计划到 survey.md（目标 + 步骤 + 模式）。只传要改的项：不传 steps 就保留现有步骤与打勾状态，不传 mode 就沿用当前模式，不传 goal 就保留原目标。',
      parameters: objectSchema(
        {
          expert: { type: 'string', description: '专家 id' },
          goal: { type: 'string', description: '这次尽调要回答的问题（可选）' },
          mode: { type: 'string', enum: MODES, description: '并行/串行/独立工作区（可选）' },
          steps: { type: 'array', items: { type: 'string' }, description: '调研步骤，按执行顺序（可选，传了就整体替换）' },
          title: { type: 'string', description: '计划标题（可选）' },
        },
        ['expert'],
      ),
      output: { schema: textValueSchema, render: renderText },
      async execute(args, exec) {
        const id = assertExpertId(args.expert)
        const expert = await library.readExpert(id)
        const steps = Array.isArray(args.steps)
          ? args.steps.map((step) => {
              const existing = expert.survey.steps.find((item) => item.text === step)
              return { text: step, done: existing?.done ?? false }
            })
          : expert.survey.steps
        const mode = args.mode ?? expert.survey.mode
        const goal = args.goal ?? expert.survey.goal
        const content = renderSurvey({
          title: args.title ?? `${expert.title} · 尽调计划`,
          goal,
          mode,
          steps,
          records: expert.survey.records,
        })
        await library.writeText(join(library.expertRel(id), 'survey.md'), content)
        await library.writeJson(join(library.expertRel(id), 'manifest.json'), renderManifest({ ...expert, mode, status: 'surveying' }))
        await regenerateIndex(library)
        await trace({ kind: 'plan', expert: id, path: `${id}/survey.md`, mode }, exec)
        changed()
        return { text: `已写入 ${id}/survey.md（${mode}，${steps.length} 步，目标${args.goal ? '已更新' : '未变'}）。`, expert: id }
      },
    },

    {
      name: 'expert_mode',
      description: '切换某个专家的调研模式（parallel 并行 / serial 串行 / workspace 独立工作区），不动步骤与进度记录。',
      parameters: objectSchema(
        {
          expert: { type: 'string', description: '专家 id' },
          mode: { type: 'string', enum: MODES, description: '要切换到的模式' },
        },
        ['expert', 'mode'],
      ),
      output: { schema: textValueSchema, render: renderText },
      async execute(args, exec) {
        const id = assertExpertId(args.expert)
        const expert = await library.readExpert(id)
        if (expert.survey.steps.length === 0) {
          return { text: `专家 ${id} 还没有调研计划，先用 expert_plan 定步骤再切模式。`, expert: id }
        }
        await library.updateSurvey(id, { mode: args.mode })
        await library.writeJson(join(library.expertRel(id), 'manifest.json'), renderManifest({ ...expert, mode: args.mode }))
        await regenerateIndex(library)
        await trace({ kind: 'plan', expert: id, path: `${id}/survey.md`, mode: args.mode, action: 'mode' }, exec)
        changed()
        const hint = args.mode === 'parallel'
          ? '下一步用 expert_dispatch 一次拿到全部子任务提示。'
          : args.mode === 'serial'
            ? '下一步用 expert_next 拿一条，做完 expert_record 再拿下一条。'
            : '下一步用 expert_workspace 建独立工作区，在新会话里跑。'
        return { text: `专家 ${id} 已切到 ${args.mode}。${hint}`, expert: id }
      },
    },

    {
      name: 'expert_next',
      description: '串行模式专用：返回下一条还没完成的调研步骤（含现成的子任务提示），你做完这一步调 expert_record 记进度，再调一次拿下一步。全部完成时返回收尾建议。',
      parameters: objectSchema({ expert: { type: 'string', description: '专家 id' } }, ['expert']),
      output: { schema: textValueSchema, render: renderText },
      async execute(args, exec) {
        const id = assertExpertId(args.expert)
        const expert = await library.readExpert(id)
        const base = library.expertDir(id)
        const pending = expert.survey.steps.filter((step) => !step.done)
        if (expert.survey.steps.length === 0) {
          return { text: `专家 ${id} 还没有调研计划，先用 expert_plan 定步骤。`, expert: id, count: 0 }
        }
        if (pending.length === 0) {
          const next = expert.survey.mode === 'parallel'
            ? '计划已全部完成。若要补料，用 expert_plan 追加步骤后 expert_dispatch。'
            : '计划已全部完成。若要补料，用 expert_plan 追加步骤，会从新步骤继续。'
          return { text: next, expert: id, count: 0 }
        }
        const step = pending[0]
        const mode = expert.survey.mode || 'serial'
        let rhythmLine = ''
        try {
          const settings = await readSettings(library.root)
          rhythmLine = rhythmGuide({ reportMode: settings?.reportMode })
        } catch {}
        const modeLine = mode === 'serial'
          ? `当前模式：serial（在本会话按步骤检索，不派子智能体、不手写资料目录）。`
          : `当前模式：${mode}。`
        const prompt = [
          `你是「${expert.title}」专家库的调研执行者（专家 id：${id}），本轮只做一步。`,
          modeLine,
          `步骤 ${step.index}：${step.text}`,
          `资料与产出都在 ${base} 下，先读 ${join(base, 'references', 'index.md')} 找对应资料。`,
          `产出：一份结论型 md，写到 ${join(base, 'references')} 下（文件名带主题），格式＝结论速查 + 每条标来源 + 末尾「冲突与未验证」。`,
          `不要动已有结论文件，不要动其它专家目录。`,
          `完成后：调 expert_record（expert=${id}, step=${step.index}, status=done, summary=关键数字与来源），然后再调 expert_next 拿下一步。`,
          `回复只写 3–8 行摘要，不要贴全文。`,
        ].join('\n')
        const remaining = pending.length - 1
        return {
          text: [
            `还剩 ${pending.length} 步，这条是第 ${step.index} 步（${mode}）。`,
            '',
            prompt,
            '',
            `这一步做完后，用 expert_record({ expert: "${id}", step: ${step.index}, status: "done", summary: "关键数字与来源" }) 写回 ${join(base, 'survey.md')}，再调 expert_next 拿下一步（还剩 ${remaining} 步）。`,
            rhythmLine ? '' : '',
            rhythmLine,
          ].filter((line) => line !== undefined).join('\n'),
          expert: id,
          count: pending.length,
        }
      },
    },

    {
      name: 'expert_record',
      description: '给专家的 survey.md 追加一条进度记录；可把某一步标记完成。调研过程中每完成一步就调用一次。',
      parameters: objectSchema(
        {
          expert: { type: 'string', description: '专家 id' },
          step: { type: 'number', description: '第几步（从 1 开始）' },
          status: { type: 'string', enum: ['done', 'blocked', 'skipped'], description: '这一步的结果' },
          summary: { type: 'string', description: '结论摘要，写关键数字与来源，不写空话' },
          markStepDone: { type: 'boolean', description: '是否同时把该步在步骤列表里打勾' },
          force: { type: 'boolean', description: '跳过前面未完成的步骤硬记（需在 summary 里写清为什么）' },
        },
        ['expert', 'step', 'status', 'summary'],
      ),
      output: { schema: textValueSchema, render: renderText },
      async execute(args, exec) {
        const id = assertExpertId(args.expert)
        if (isDispatchChild(exec)) {
          return { text: '这是派发出来的调研子会话：把结论写在正文里，进度由 expert_dispatch 统一记，别自己调 expert_record。', expert: id, count: 0 }
        }
        const expert = await library.readExpert(id)
        if (args.force !== true && args.status !== 'skipped') {
          const blocking = expert.survey.steps.filter((step) => step.index < args.step && !step.done)
          if (blocking.length > 0) {
            return {
              text: [
                `第 ${args.step} 步前面还有 ${blocking.length} 步没完成，按顺序不能跳过：`,
                ...blocking.map((step) => `- 第 ${step.index} 步：${step.text}`),
                `先做第 ${blocking[0].index} 步（可用 expert_next 取现成子任务），或确实要跳就传 force: true 并在 summary 里写原因。`,
              ].join('\n'),
              expert: id,
              count: 0,
            }
          }
        }
        const steps = expert.survey.steps.map((item, index) =>
          index + 1 === args.step ? { ...item, done: args.markStepDone === true || args.status === 'done' ? true : item.done } : item,
        )
        const records = [...expert.survey.records, { step: args.step, status: args.status, note: args.summary, at: new Date().toISOString().slice(0, 16).replace('T', ' ') }]
        const content = renderSurvey({ title: `${expert.title} · 尽调计划`, goal: expert.survey.goal, mode: expert.survey.mode, steps, records })
        await library.writeText(join(library.expertRel(id), 'survey.md'), content)
        const done = steps.filter((step) => step.done).length
        const status = done >= steps.length && steps.length > 0 ? 'ready' : 'surveying'
        await library.writeJson(join(library.expertRel(id), 'manifest.json'), renderManifest({ ...expert, status }))
        await regenerateIndex(library)
        await trace({ kind: 'write', expert: id, path: `${id}/survey.md`, step: args.step, status: args.status }, exec)
        changed()
        return { text: `已记录 ${id} 第 ${args.step} 步：${args.status}（${done}/${steps.length}）。`, expert: id }
      },
    },

    {
      name: 'expert_workspace',
      description:
        '为专家建独立调研工作区：写 <根>\\<专家>\\workspace\\brief.md，并直接开一个新会话（带开场消息）跑这一轮，不占主对话上下文；宿主没有 agents 服务时退回给开场提示。',
      parameters: objectSchema(
        {
          expert: { type: 'string', description: '专家 id' },
          goal: { type: 'string', description: '这一轮工作区要查清什么；省略则用 survey.md 的目标' },
        },
        ['expert'],
      ),
      output: { schema: textValueSchema, render: renderText },
      async execute(args, exec) {
        const id = assertExpertId(args.expert)
        if (isDispatchChild(exec)) {
          return { text: '这是派发出来的调研子会话，不要再开工作区：直接把结论写在正文里结束本轮。', expert: id, count: 0 }
        }
        const { research } = await readSettings(library.root)
        if (research !== 'workspace') {
          const why = research === 'serial'
            ? '当前是「一条条查」，不开新会话：按 expert_next 一步步做，结论用 expert_record 记回去。'
            : '当前是「并行派发」，用 expert_dispatch 派子智能体，不要开工作区。'
          return { text: `没有开工作区：${why}（可在设置里改「调研的时候怎么查」）`, expert: id, count: 0 }
        }
        const expert = await library.readExpert(id)
        const goal = String(args.goal ?? expert.survey.goal ?? '').trim() || '（未写目标）'
        const steps = expert.survey.steps.length > 0
          ? expert.survey.steps.map((step) => `- [${step.done ? 'x' : ' '}] ${step.index}. ${step.text}`)
          : ['- （未定步骤，可用 expert_plan 补）']
        const base = library.expertDir(id)
        const brief = [
          `# ${expert.title} · 工作区简报`,
          '',
          `专家 id：${id}　技能名：${expert.skillName}`,
          `专家目录：${base}`,
          `资料索引：${join(base, 'references', 'index.md')}`,
          '',
          '## 目标',
          '',
          goal,
          '',
          '## 步骤',
          '',
          ...steps,
          '',
          '## 规矩',
          '',
          '1. 产出只写进本工作区的 `out\\`，或经确认后写 `references\\`；不改已有结论文件。',
          '2. 每完成一步，调 `expert_record` 把结论记回 `survey.md`（写完再继续下一步）。',
          '3. 回复里写清用了哪几份资料、关键数字与日期；资料没有的写「资料未覆盖」，不要臆测。',
          '4. 回到主会话时只报摘要（做了什么、结论、还缺什么），不要贴长文。',
          '',
        ].join('\n')
        const briefPath = join(base, 'workspace', 'brief.md')
        await library.writeText(join(library.expertRel(id), 'workspace', 'brief.md'), brief)
        await library.writeText(join(library.expertRel(id), 'workspace', 'out', '.gitkeep'), '')
        const kickoff = [
          `你在「${expert.title}」的独立调研工作区里工作。先读 ${join(base, 'workspace', 'brief.md')}，`,
          `按其中目标和步骤调研；资料先看 ${join(base, 'references', 'index.md')}。`,
          `产出写本工作区 out\\；每步完成调 expert_record 记回 ${join(base, 'survey.md')}。`,
        ].join('')
        const workspaceDir = join(base, 'workspace')
        const opened = hooks.openWorkspace
          ? await hooks.openWorkspace({ expertId: id, cwd: workspaceDir, kickoff, exec })
          : hooks.openSession
            ? await hooks.openSession({ expertId: id, cwd: workspaceDir, kickoff, exec })
            : { sessionId: null, error: '没有接入会话能力' }
        if (opened.sessionId) {
          try {
            hooks.watchWorkspace?.({ expertId: id, sessionId: opened.sessionId })
          } catch {
            /* 收尾监听挂了不影响开会话 */
          }
          await library.appendTrace({
            ts: new Date().toISOString(),
            kind: 'workspace',
            expert: id,
            path: `${id}/workspace/brief.md`,
            session: opened.sessionId,
          })
          return {
            text: [
              `工作区已建：${workspaceDir}`,
              `简报：${briefPath}`,
              opened.reused
                ? `接着用原来那个会话：${opened.sessionId}（没有新开会话，开场消息已投进去）`
                : `新会话已开好：${opened.sessionId}（工作目录＝该 workspace，开场消息已投进去）`,
              opened.error ? `注意：${opened.error}` : '',
              '主会话不用等它，之后用 expert_status 看进度就行。',
            ].filter(Boolean).join('\n'),
            expert: id,
            count: 1,
          }
        }
        return {
          text: [
            `工作区已建：${workspaceDir}`,
            `简报：${briefPath}`,
            opened.error ? `没能自动开新会话：${opened.error}` : '',
            '',
            '改在新会话里开场用这段：',
            '',
            kickoff,
            '',
            '注意：新会话的工作目录请设为该 workspace；主会话只看 expert_status 的进度摘要。',
          ].filter(Boolean).join('\n'),
          expert: id,
          count: 0,
        }
      },
    },

    {
      name: 'expert_dispatch',
      description:
        '真并行派发：为每个未完成步骤各建一个独立会话跑调研，跑完把结论自动记回 survey.md，并返回一段合并去重 prompt。不传 steps 就用 survey.md 里未完成的步骤；run=false 只出 prompt、不建会话。',
      parameters: objectSchema(
        {
          expert: { type: 'string', description: '专家 id' },
          steps: { type: 'array', items: { type: 'string' }, description: '要并发调研的步骤文本；省略则取未完成步骤' },
          run: { type: 'boolean', description: '是否真的建会话跑（默认 true）。只想看 prompt 时传 false' },
        },
        ['expert'],
      ),
      output: { schema: textValueSchema, render: renderText },
      async execute(args, exec) {
        const id = assertExpertId(args.expert)
        if (isDispatchChild(exec)) {
          return { text: '这是调研子会话，不能再向外派发；把结论写回并结束本轮即可。', expert: id, count: 0 }
        }
        const { research } = await readSettings(library.root)
        if (research !== 'parallel') {
          const why = research === 'serial'
            ? '当前是「一条条查」：用 expert_next 拿到下一步的子任务提示，自己做完再 expert_record。'
            : '当前是「独立工作区」：在 expert_workspace 开出的那个会话里一条条做，不要再向外派发。'
          return { text: `没有派发：${why}（可在设置里改「调研的时候怎么查」）`, expert: id, count: 0 }
        }
        const expert = await library.readExpert(id)
        const base = library.expertDir(id)
        // 传 steps 时要对齐 survey.md 里已有的步骤序号：按文本匹配复用原序号，
        // 匹配不到才当新步骤排在末尾。否则「只重跑第 2 步」会被当成第 1 步记回去。
        const picked = Array.isArray(args.steps) && args.steps.length > 0
          ? args.steps.map((text, offset) => {
            const wanted = String(text).trim()
            const hit = expert.survey.steps.find((step) => !step.done && String(step.text).trim() === wanted)
            return hit ?? { index: expert.survey.steps.length + offset + 1, text: wanted, done: false }
          })
          : expert.survey.steps.filter((step) => !step.done)
        if (picked.length === 0) {
          return { text: `专家 ${id} 没有待调研步骤：先用 expert_plan 定计划，或显式传 steps。`, expert: id, count: 0 }
        }
        if (isDispatchChild(exec)) {
          return { text: '这是调研子会话，不能再向外派发；把结论写回并结束本轮即可。', expert: id, count: 0 }
        }
        const prompts = picked.map((step) =>
          [
            `你是「${expert.title}」专家库的调研子智能体（专家 id：${id}）。`,
            `只做第 ${step.index} 步：${step.text}`,
            `资料与产出都在 ${base} 下，先读 ${join(base, 'references', 'index.md')} 找对应资料。`,
            `产出：一份结论型 md，写到 ${join(base, 'references')} 下（文件名带主题），格式＝结论速查（每条一句可执行做法）+ 每条标来源路径与行号 + 末尾「冲突与未验证」。`,
            `不要改写已有文件，不要动其它专家目录。`,
            `返回：3–8 行摘要，写关键数字与用了哪些资料，不要贴全文。`,
          ].join('\n'),
        )
        const mergePrompt = [
          `你是合并子智能体（专家 id：${id}）。`,
          `读 ${join(base, 'references')} 下本轮新增的结论文件，做三件事：`,
          `① 合并重复结论，保留数字最完整的一条；`,
          `② 标出互相冲突的说法，写成「冲突：A 说…（来源）vs B 说…（来源）」；`,
          `③ 输出 ${join(base, 'references', '00-合并摘要.md')}：结论速查 + 冲突清单 + 资料缺口。`,
          `只改这一份文件，不要动已有结论文件。`,
        ].join('\n')
        const parts = [
          `并发派发（用 subagent 工具一次发出 ${prompts.length} 个，不要串行、不要等一个再发下一个）：`,
          ...prompts.map((prompt, index) => `
--- 子任务 ${index + 1} ---
${prompt}`),
          `
--- 合并（等全部返回后再发 1 个）---
${mergePrompt}`,
          `
注意：子智能体之间不要写同一个文件；全部返回后调 expert_record 记每步进度。`,
        ]

        const shouldRun = args.run !== false && typeof hooks.runTasks === 'function'
        if (!shouldRun) {
          return { text: parts.join('\n'), expert: id, count: prompts.length }
        }

        const tasks = picked.map((step, index) => ({ step: step.index, text: step.text, prompt: prompts[index] }))
        const results = await hooks.runTasks(tasks, exec, id)
        if (results && results.locked) {
          return {
            text: `没有派发：这位专家已经有一轮调研在跑（从 ${results.runningSince} 开始）。等它结束再来，免得两个子会话同时写同一份进度记录。`,
            expert: id,
            count: 0,
          }
        }
        const records = []
        const lines = []
        for (const result of results) {
          const unfinished = !result.error && looksUnfinished(result.text)
          const ok = !result.error && !unfinished
          const summary = result.error
            ? `未完成：${result.error}`
            : unfinished
              ? `未完成（子会话自己说做不了）：${String(result.text).split('\n').slice(0, 4).join(' ')}`
              : `结论摘要：${result.text.split('\n').slice(0, 6).join(' ')}`
          records.push({ step: result.step, status: ok ? 'done' : 'blocked', summary: summary.slice(0, 600), at: new Date().toISOString() })
          lines.push(
            ok
              ? `第 ${result.step} 步完成（${Math.round(result.ms / 1000)} 秒，会话 ${result.sessionId.slice(0, 24)}…）`
              : result.error
                ? `第 ${result.step} 步失败：${result.error}`
                : `第 ${result.step} 步没做成：子会话说它没有可用的工具或做不了（正文已记进 survey）`,
          )
        }
        const okCount = results.filter((result) => !result.error && !looksUnfinished(result.text)).length
        const merged = records.filter((record) => record.status === 'done').map((record) => record.summary).join('\n')
        await library.updateSurvey(id, {
          records: [
            ...expert.survey.records,
            ...records,
          ],
          ...(merged ? { steps: expert.survey.steps.map((step) => (
            records.some((record) => record.step === step.index && record.status === 'done') ? { ...step, done: true } : step
          )) } : {}),
        })
        await library.appendTrace({
          session: sessionIdOf(exec),
          kind: 'subagent',
          expert: id,
          chars: merged.length,
          // 记下这批子会话，面板据此把「插件开的会话」挂回发起它的对话。
          children: results.map((result) => result.sessionId).filter(Boolean),
        })
        return {
          text: [
            `已真派发 ${tasks.length} 个步骤：完成 ${okCount}，失败 ${tasks.length - okCount}。`,
            ...lines,
            '',
            `合并提示（等全部结束后再发 1 个）：`,
            mergePrompt,
          ].join('\n'),
          expert: id,
          count: okCount,
        }
      },
    },

    {
      name: 'expert_find',
      description: '按关键词在专家库的资料索引里查资料。命中返回资料名与路径；没命中返回 missing: true 和两个选项，要求先问用户，不要用模型记忆硬编。',
      parameters: objectSchema(
        {
          query: { type: 'string', description: '要查什么，例如 行高、一致性、LoRA' },
          expert: { type: 'string', description: '限定某个专家 id；不填则查全部专家' },
        },
        ['query'],
      ),
      output: { schema: findValueSchema, render: renderText },
      async execute(args, exec) {
        const tokens = tokenize(args.query)
        if (tokens.length === 0) {
          return { text: '请给一个关键词再查。', count: 0, missing: true }
        }
        const ids = args.expert ? [assertExpertId(args.expert)] : await library.listExpertIds()
        const hits = []
        const seen = new Set()
        // 先走资料级向量检索：不分专家、不打分到「哪位专家」，直接找最像的资料。
        // 检索不可用（模型缺失/首次加载失败）时静默退回关键词路径。
        let confidence = null
        try {
          const semantic = await hooks.retrieve?.(args.query, { expert: args.expert, k: 5 })
          if (semantic) {
            confidence = { lowConfidence: semantic.lowConfidence, close: semantic.close, top1: semantic.top1, top2: semantic.top2 }
            // 自检：把这次检索的结果与风险标记落盘，供面板「自检」看。
            await recordRetrieval(library.root, {
              session: String(exec?.agent?.session?.id ?? ''),
              query: args.query,
              expert: args.expert ?? null,
              mode: semantic.mode ?? null,
              top: (semantic.all ?? semantic.top ?? []).slice(0, 5).map((doc) => ({
                expert: doc.expert,
                title: doc.title,
                rel: doc.rel,
                score: doc.score,
              })),
            })
          }
          for (const doc of semantic?.top ?? []) {
            if (args.expert && doc.expert !== args.expert) continue
            const expert = await library.readExpert(doc.expert).catch(() => null)
            const key = `${doc.expert}|v|${doc.rel}`
            if (seen.has(key)) continue
            seen.add(key)
            hits.push({
              expert: doc.expert,
              skillName: expert?.skillName ?? `expert-${doc.expert}`,
              title: doc.title,
              name: doc.title,
              why: doc.summary ? `${doc.summary}（相似度 ${doc.score.toFixed(3)}）` : `相似度 ${doc.score.toFixed(3)}`,
              files: [`${library.expertDir(doc.expert)}/${doc.rel}`.replace(/\\/g, '/')],
            })
          }
        } catch (err) {
          // 落一条失败记录：静默降级是上一次排查最大的障碍（2026-11-21）。
          await recordRetrievalFailure(library.root, {
            session: String(exec?.agent?.session?.id ?? ''),
            query: args.query,
            expert: args.expert ?? null,
            error: err instanceof Error ? err.message : String(err),
          })
        }
        for (const id of ids) {
          const expert = await library.readExpert(id).catch(() => null)
          if (!expert) continue
          for (const topic of expert.topics ?? []) {
            const hay = [topic.title, topic.whenToUse, ...(topic.files ?? [])].join(' ')
            if (!matchesAny(hay, tokens)) continue
            const key = `${id}|${topic.title}`
            if (seen.has(key)) continue
            seen.add(key)
            hits.push({ expert: id, title: topic.title, files: topic.files ?? [] })
          }
          const index = await library.readText(join(library.expertRel(id), 'references', 'index.md')).catch(() => '')
          for (const line of String(index).split('\n')) {
            if (!line.trim().startsWith('|')) continue
            if (!matchesAny(line, tokens)) continue
            const key = `${id}|row|${line.trim()}`
            if (seen.has(key)) continue
            seen.add(key)
            const cells = line.split('|').map((part) => part.trim()).filter(Boolean)
            hits.push({ expert: id, title: cells[0] ?? '', files: [cells[1] ?? ''].filter(Boolean) })
          }
        }
        if (hits.length === 0) {
          await recordMiss(library, queryExpert(args), args.query)
          const forward = await handoffHint(library, queryExpert(args), args.query)
          return {
            text: [
              ...(forward ? [forward.text, ''] : []),
              await missGuidance({ library, expertId: queryExpert(args), query: args.query }),
              '',
              '先问用户选哪个，不要用模型自己的记忆硬编。',
            ].join('\n'),
            count: 0,
            missing: true,
          }
        }
        const lines = hits.slice(0, 10).map((hit) => `- [${hit.expert}] ${hit.title}${hit.files[0] ? '　' + hit.files[0] : ''}`)
        const note = confidenceNote(confidence)
        return { text: [note, `命中 ${hits.length} 条：`, ...lines].filter(Boolean).join('\n'), count: hits.length, missing: false }
      },
    },

    {
      name: 'lookup_expert_knowledge',
      description:
        '在本地领域专家库里查资料，查完再回答。Use when 用户问 AI 生图 / 提示词 / 角色一致性 / AI 短剧 / 阅读器 / 播放器 / 安卓自动化 / DSH 插件 / 界面交互 这类问题，或需要引用本机调研结论时。返回该读哪几份资料（专家、中文名、路径）；库里没有就返回 missing，要求先问用户，不许凭记忆硬编。',
      parameters: objectSchema(
        {
          query: { type: 'string', description: '要查什么，用用户原话里的关键词，例如 行高、一致性、LoRA、分页' },
          expert: { type: 'string', description: '限定某个专家 id；不填则全库查' },
        },
        ['query'],
      ),
      output: { schema: findValueSchema, render: renderText },
      async execute(args, exec) {
        const tokens = tokenize(args.query)
        if (tokens.length === 0) {
          return { text: '请给一个关键词再查。', count: 0, missing: true }
        }
        const ids = args.expert ? [assertExpertId(args.expert)] : await library.listExpertIds()
        const hits = []
        const seen = new Set()
        // 先走资料级向量检索（不分专家、不打分到「哪位专家」），失败静默退回关键词。
        let confidence = null
        try {
          const semantic = await hooks.retrieve?.(args.query, { expert: args.expert, k: 5 })
          if (semantic) {
            confidence = { lowConfidence: semantic.lowConfidence, close: semantic.close, top1: semantic.top1, top2: semantic.top2 }
            // 自检：把这次检索的结果与风险标记落盘，供面板「自检」看。
            await recordRetrieval(library.root, {
              session: String(exec?.agent?.session?.id ?? ''),
              query: args.query,
              expert: args.expert ?? null,
              mode: semantic.mode ?? null,
              top: (semantic.all ?? semantic.top ?? []).slice(0, 5).map((doc) => ({
                expert: doc.expert,
                title: doc.title,
                rel: doc.rel,
                score: doc.score,
              })),
            })
          }
          for (const doc of semantic?.top ?? []) {
            if (args.expert && doc.expert !== args.expert) continue
            const expert = await library.readExpert(doc.expert).catch(() => null)
            const key = `${doc.expert}|v|${doc.rel}`
            if (seen.has(key)) continue
            seen.add(key)
            hits.push({
              expert: doc.expert,
              skillName: expert?.skillName ?? `expert-${doc.expert}`,
              name: doc.title,
              why: doc.summary ? `${doc.summary}（相似度 ${doc.score.toFixed(3)}）` : `相似度 ${doc.score.toFixed(3)}`,
              files: [`${library.expertDir(doc.expert)}/${doc.rel}`.replace(/\\/g, '/')],
            })
          }
        } catch (err) {
          // 与上面同一条：静默降级必须留痕（2026-11-21 排查事故）。
          await recordRetrievalFailure(library.root, {
            session: String(exec?.agent?.session?.id ?? ''),
            query: args.query,
            expert: args.expert ?? null,
            error: err instanceof Error ? err.message : String(err),
          })
        }
        for (const id of ids) {
          const expert = await library.readExpert(id).catch(() => null)
          if (!expert) continue
          const topics = expert.topics ?? []
          for (const topic of topics) {
            const hay = [topic.title, topic.whenToUse, ...(topic.files ?? [])].join(' ')
            if (!matchesAny(hay, tokens)) continue
            const key = `${id}|t|${topic.id ?? topic.title}`
            if (seen.has(key)) continue
            seen.add(key)
            hits.push({
              expert: id,
              skillName: expert.skillName,
              name: topic.title,
              why: topic.whenToUse ?? '',
              files: (topic.files ?? []).slice(0, 3).map((rel) => `${library.expertDir(id)}/${rel}`.replace(/\\/g, '/')),
            })
          }
          const index = await library.readText(join(library.expertRel(id), 'references', 'index.md')).catch(() => '')
          for (const line of String(index).split('\n')) {
            if (!line.trim().startsWith('|') || !matchesAny(line, tokens)) continue
            const cells = line.split('|').map((part) => part.trim()).filter(Boolean)
            if (cells.length < 2) continue
            const key = `${id}|r|${cells[0]}\u0000${cells[1]}`
            if (seen.has(key)) continue
            seen.add(key)
            const rel = (cells[1].match(/`([^`]+)`/) ?? [])[1] ?? cells[1]
            hits.push({
              expert: id,
              skillName: expert.skillName,
              name: cells[0],
              why: cells[2] ?? '',
              files: [`${library.expertDir(id)}/${rel.replace(/\\/g, '/')}`],
            })
          }
        }
        if (hits.length === 0) {
          await recordMiss(library, queryExpert(args), args.query)
          const forward = await handoffHint(library, queryExpert(args), args.query)
          return {
            text: [
              ...(forward ? [forward.text, ''] : []),
              await missGuidance({ library, expertId: queryExpert(args), query: args.query }),
              '',
              '先问用户选哪个，不要用模型自己的记忆硬编。',
            ].join('\n'),
            count: 0,
            missing: true,
          }
        }
        const lines = []
        for (const hit of hits.slice(0, 8)) {
          lines.push(`- [${hit.expert}] ${hit.name}${hit.why ? `（${hit.why}）` : ''}`)
          for (const file of hit.files) lines.push(`    读 ${file}`)
          lines.push(`    技能 ${hit.skillName}`)
        }
        const note = confidenceNote(confidence)
        return {
          text: [note, `命中 ${hits.length} 条。先读下面这几份，再回答；引用时写出文件名。`, ...lines].filter(Boolean).join('\n'),
          count: hits.length,
          missing: false,
        }
      },
    },

    {
      name: 'expert_ingest',
      description:
        '把手头的一份资料（目录或文件）搬进某个专家并登记：读取标题与首段，写进该专家的资料索引与清单，原位置不再保留。只强制 expert 与 source；topic/title/slug/useWhen/summary 不填就推断并标记为自动推断。',
      parameters: objectSchema(
        {
          expert: { type: 'string', description: '专家 id，例如 ai-image' },
          source: { type: 'string', description: '资料目录或文件的绝对路径' },
          topic: { type: 'string', description: '归到哪个主题（标题或 id）；不填则放进「未归类」' },
          title: { type: 'string', description: '资料名（中文，显示用）；不填取正文第一行 # 标题或目录名' },
          slug: { type: 'string', description: '英文目录名，例如 prompt-weighting_20261113；不填按标题生成' },
          useWhen: { type: 'string', description: '什么时候该读这份资料；不填按标题生成一句' },
          summary: { type: 'string', description: '一句话结论；不填取首段首句' },
        },
        ['expert', 'source'],
      ),
      output: { schema: textValueSchema, render: renderText },
      async execute(args, exec) {
        const result = await ingestSource(library, args)
        await trace(
          {
            kind: 'ingest',
            expert: result.expert,
            path: result.path,
            chars: result.summary.length,
            auto: result.autoFields,
          },
          exec,
        )
        const flags = result.autoFields.length > 0 ? `（自动推断：${result.autoFields.join('、')}）` : ''
        const action = result.existed ? '已在清单里，只补了索引行' : result.moved ? '已搬进专家库并登记' : '已登记'
        return {
          text: [
            `${action}：${result.title}${flags}`,
            `专家：${result.expert}　主题：${result.topic}`,
            `库内路径：${result.path}`,
            `一句话：${result.summary}`,
            '',
            '要看效果：expert_list 看阶段与数量，面板「有什么资料」看清单。',
          ].join('\n'),
          expert: result.expert,
          count: 1,
        }
      },
    },

    {
      name: 'expert_status',
      description: '读取某个专家的当前状态：计划目标、步骤完成情况、最近进度记录。',
      parameters: objectSchema({ expert: { type: 'string', description: '专家 id' } }, ['expert']),
      output: { schema: textValueSchema, render: renderText },
      async execute(args, exec) {
        const id = assertExpertId(args.expert)
        const expert = await library.readExpert(id)
        const steps = expert.survey.steps.map((step) => `${step.done ? '[x]' : '[ ]'} ${step.index}. ${step.text}`)
        const records = expert.survey.records.slice(-8).map((record) => `- ${record.step} ${record.status}：${record.note}（${record.at}）`)
        const lines = [
          `专家：${id}（${expert.title}）`,
          `状态：${expert.status}　模式：${expert.mode}　技能名：${expert.skillName}`,
          `目标：${expert.survey.goal || '（未设置）'}`,
          '',
          '步骤：',
          ...(steps.length > 0 ? steps : ['（未设置）']),
          '',
          '最近记录：',
          ...(records.length > 0 ? records : ['（无）']),
        ]
        return { text: lines.join('\n'), expert: id }
      },
    },
    {
      name: 'expert_source',
      description:
        '列某位专家登记的源码与资料路径（按可信度 S>A>B>C>D 排序）。源码只登记路径不复制，回答前先看有没有 S 级源码可以直接照着做。Use when 要照现成代码实现、或需要判断「这件事我们有没有做过」。',
      parameters: objectSchema(
        {
          expert: { type: 'string', description: '专家 id，例如 ai-image' },
          level: { type: 'string', enum: ['S', 'A', 'B', 'C', 'D'], description: '只看某一级；不填列全部' },
        },
        ['expert'],
      ),
      output: { schema: textValueSchema, render: renderText },
      async execute(args) {
        const id = assertExpertId(args.expert)
        const expert = await library.readExpert(id).catch(() => null)
        if (!expert) return { text: `没有这位专家：${id}` }
        const all = sourcesOf(expert)
        const rows = args.level ? all.filter((item) => item.level === args.level) : all
        if (rows.length === 0) {
          return { text: `${expert.title}（${id}）还没有登记源码或资料路径。`, expert: id, count: 0 }
        }
        const byLevel = {}
        for (const row of rows) byLevel[row.level] = (byLevel[row.level] ?? 0) + 1
        const head = Object.keys(byLevel).map((lv) => `${lv} ${byLevel[lv]}`).join(' · ')
        return {
          text: [
            `${expert.title}（${id}）登记了 ${rows.length} 条：${head}`,
            '',
            renderSources(rows),
            '',
            '用法：S 级是本人确认过的自有项目源码，可以直接照着做；A 级是复用过的第三方；B 级只存档不作依据；C 是文档与调研；D 是推测，引用时必须说明「未验证」。',
          ].join('\n'),
          expert: id,
          count: rows.length,
        }
      },
    },

    {
          name: 'expert_pending',
          description:
            '读取或完成「缺口处置待办」：用户在面板上标了「回收 / 去查」的事会排进队列，用这个工具取出来做，做完标记完成。回收＝把已有人做过的产出整理成一条方法；去查＝按该专家的调研计划去查。',
          parameters: objectSchema(
            {
              action: { type: 'string', enum: ['list', 'done'], description: 'list 取待办；done 标完成' },
              id: { type: 'string', description: 'done 时必填，待办 id（专家|主题|动作）' },
            },
            ['action'],
          ),
          output: { schema: textValueSchema, render: renderText },
          async execute(args) {
            if (args.action === 'done') {
              const result = await finishPending(library.root, String(args.id ?? ''))
              if (!result.ok) return { text: result.error }
              return {
                text: `已完成：${result.item.expert} · ${result.item.title}（${result.item.action}）`,
                expert: result.item.expert,
              }
            }
            const rows = await listPending(library.root, 'queued')
            if (rows.length === 0) return { text: '没有待办的缺口处置。', count: 0 }
            const lines = rows.map(
              (row, index) =>
                `${index + 1}. [${row.action === 'recover' ? '回收' : '去查'}] ${row.expert} · ${row.title}（id ${row.id}）`,
            )
            return {
              text: [
                `共 ${rows.length} 件待办：`,
                ...lines,
                '',
                '做法：回收 → 找到那次会话的产出，整理成 references/methods/ 下一条方法（写清来源会话与验证程度）；去查 → 用 expert_next 取该专家的下一步，查完用 expert_record 写回。做完调 expert_pending({ action: "done", id }) 标记。',
              ].join('\n'),
              count: rows.length,
            }
          },
        },
  ]
}

// 把「检索有多确定」翻成一句人话，交给模型决定要不要硬选。
export function confidenceNote(c) {
  if (!c) return ''
  const s1 = (c.top1 ?? 0).toFixed(3)
  if (c.lowConfidence) {
    return `不太确定：最高相似度只有 ${s1}，这几份都不太像，可能库里没有。先读下面几份确认；确认没有就直说「库里没覆盖」，不要硬答。`
  }
  if (c.close && c.top2 != null) {
    return `前两份得分很接近（${s1} / ${c.top2.toFixed(3)}），两份都读再判断。`
  }
  return ''
}

export function registerExpertTools(ctx, library, hooks = {}) {
  const disposers = []
  for (const definition of createToolDefinitions(library, hooks)) {
    disposers.push(ctx.tools.register(definition))
  }
  return disposers
}

export async function bootLibrary(root) {
  const library = new ExpertLibrary(root)
  await library.ensureRoot()
  return library
}

export { parseFrontmatter }
