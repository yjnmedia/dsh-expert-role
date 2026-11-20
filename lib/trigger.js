// 主动提醒：按 settings.json 的 mode 决定要不要在回合开始时插一行提醒。
//
// 三档（用户 2026-11-16 定）：
//  - auto       关键词命中某位专家的领域 → 提醒一次（默认）
//  - on-request 只有用户明确说「调用 / 问问 / 查阅某专家或资料库」才提醒
//  - off        什么都不做，专家库保持静默
//
// 依据（DSH 0.2.2-rc.3）：agent/pre-step 是瀑布，能改 decision.messages；
// 技能目录只渲染 name + description，whenToUse 会被丢掉，所以只能靠回合开始时提醒。
// 2026-11-16 起不再用 agent/turn-stopping + steer 硬拽模型（用户明确要求别替它做决定）。

import { randomUUID } from 'node:crypto'
import { readSettings } from './settings.js'

const STOPWORDS = new Set([
  '资料', '主题', '问题', '常用', '常见', '工作', '做法', '相关', '使用', '需要', '时候',
  '什么', '怎么', '一个', '可以', '我们', '现在', '本地', '细节', '内容', '整理', '调研',
  '记录', '结论', '速查', '索引',
])

// 「调用 AI 生图专家」「问问阅读器资料库」「查阅界面与交互专家」这类句式
const REQUEST_RE =
  /(?:调用|叫上|请|问问|问一下|请教|咨询|去问|去查|查阅|查一下|翻翻|看看|用)\s*[「“"'『]?([^「」“”"'『』，。,.、；;：:\s]{1,24}?)[」”"'』]?\s*(?:专家|资料库|专家库)/

const MATCH_CACHE_MS = 30_000
const reminded = new Map()
// 同一个会话里，同一位专家 30 分钟内最多提醒一次；避免来回追问时一直插话。
const REMIND_COOLDOWN_MS = 30 * 60 * 1000
const lastRemindAt = new Map()
// 只有「在提问 / 求帮助」才提醒；纯陈述、闲聊不插话。
const HELP_RE = /[?？]|怎么|如何|为什么|为啥|该不该|能不能|可不可以|要不要|帮我|帮忙|请教|求推荐|有没有/
const CHAT_RE = /^(随便聊聊|聊聊|闲聊|闲聊一下|我在想|我记得|我觉得|你说呢|哈哈)|只是问问|不着急|顺便说/

/** 从专家身上抽出「用户可能会说的词」：标题、主题名、每个主题的 useWhen。 */
export function keywordsOf(expert) {
  const words = new Set()
  const add = (text) => {
    if (!text) return
    for (const piece of String(text).split(/[\s，。、；：！？（）()《》「」【】,.;:!?'"`~|\-_/\\]+/)) {
      const token = piece.trim()
      if (!token || STOPWORDS.has(token)) continue
      // 中文两个字起算；英文/数字至少三个字符，否则 md、to、ai 这种碎片会在
      // 任何句子里被 includes 命中，造成无关问题也被提醒。
      if (/^[\x00-\x7f]+$/.test(token)) {
        if (token.length >= 3 && /[a-z]/i.test(token)) words.add(token.toLowerCase())
      } else if (token.length >= 2) {
        words.add(token)
      }
    }
  }
  add(expert.title)
  for (const word of expert.triggerWords ?? []) add(word)
  add(expert.description)
  add(expert.id.replace(/-/g, ' '))
  for (const topic of expert.topics ?? []) {
    add(topic.title)
    add(topic.whenToUse)
  }
  return [...words]
}

function agentIdOf(agent) {
  return String(agent?.session?.id ?? agent?.id ?? 'unknown')
}

function textOf(message) {
  const content = Array.isArray(message?.content) ? message.content : []
  return content
    .filter((item) => item?.type === 'text')
    .map((item) => String(item.text ?? ''))
    .join('\n')
}

function lastUserText(messages) {
  const userMessages = (messages ?? []).filter((message) => message?.source?.kind === 'user')
  return userMessages.length > 0 ? textOf(userMessages[userMessages.length - 1]) : ''
}

function notice(text, summary) {
  return {
    id: randomUUID(),
    role: 'user',
    content: [{ type: 'text', text }],
    source: { kind: 'expert-role', form: 'notice', summary },
  }
}

export async function rowsOf(library) {
  const now = Date.now()
  if (library.__rowCache && now - library.__rowCache.at < MATCH_CACHE_MS) return library.__rowCache.rows
  const experts = await library.listExperts().catch(() => [])
  // 某个词被 3 个以上专家共用，就不是领域特征词了，留着只会误伤。
  const usage = new Map()
  for (const expert of experts) {
    for (const word of new Set(keywordsOf(expert))) usage.set(word, (usage.get(word) ?? 0) + 1)
  }
  const rows = experts.map((expert) => ({
    id: expert.id,
    title: expert.title,
    words: keywordsOf(expert).filter((word) => (usage.get(word) ?? 0) < 3),
  }))
  library.__rowCache = { at: now, rows }
  return rows
}

/** auto 档：按领域关键词命中。 */
const BOUNDARY = /[a-z0-9]/

/** 英文词按词边界匹配（避免 md 命中 .md、to 命中 auto）；中文照旧按子串。 */
function matches(lower, word) {
  const needle = word.toLowerCase()
  if (!BOUNDARY.test(needle)) return lower.includes(needle)
  let from = 0
  for (;;) {
    const at = lower.indexOf(needle, from)
    if (at < 0) return false
    const before = at === 0 ? '' : lower[at - 1]
    const after = lower[at + needle.length] ?? ''
    if (!BOUNDARY.test(before) && !BOUNDARY.test(after)) return true
    from = at + 1
  }
}

export function keywordHit(text, rows) {
  const lower = String(text).toLowerCase()
  let best
  for (const row of rows) {
    // 一条提问里常常命中多个词：按「命中次数」优先，再按最长词兜底，
    // 避免「行高 + 字号」这种阅读器问题被只命中「字号」的界面专家抢走。
    const hits = row.words.filter((word) => matches(lower, word))
    if (hits.length === 0) continue
    const longest = hits.reduce((a, b) => (b.length > a.length ? b : a), '')
    const score = hits.length * 100 + longest.length
    const prev = best ? best.hits.length * 100 + best.word.length : -1
    if (score > prev) best = { expertId: row.id, title: row.title, word: longest, hits }
  }
  return best
}

/** on-request 档：只认「调用 / 问问 / 查阅 + 专家或资料库」这种明确指令。 */
/** auto 档先过这道门：只有提问/求助、且不是闲聊，才继续看关键词。 */
export function shouldRemind(text) {
  const raw = String(text ?? '')
  return HELP_RE.test(raw) && !CHAT_RE.test(raw)
}

export function explicitHit(text, rows) {
  const raw = String(text ?? '')
  const matched = raw.match(REQUEST_RE)
  const target = matched?.[1]?.trim()
  if (target) {
    const lower = target.toLowerCase()
    for (const row of rows) {
      const title = String(row.title ?? '')
      if (!title) continue
      if (title.toLowerCase().includes(lower) || lower.includes(title.toLowerCase()) || row.id.includes(lower)) {
        return { expertId: row.id, title, word: target }
      }
    }
  }
  // 目标词和标题不完全一致时（「调用 AI 生图专家」对「AI 生图」），退一步看请求词 + 标题同时出现。
  if (matched) {
    const lower = raw.toLowerCase()
    for (const row of rows) {
      const title = String(row.title ?? '')
      if (title && lower.includes(title.toLowerCase())) return { expertId: row.id, title, word: title }
    }
  }
  return undefined
}

/** 本回合是否已经查过专家库（由 trace 钩子写进 consultState）。 */
function alreadyConsulted(consultState, agentId) {
  return Boolean(consultState?.get?.(agentId))
}

/** 调研子会话（lib/dispatch.js 建的）不该再被提醒查库。 */
function isChildTask(sessionId) {
  return String(sessionId ?? '').startsWith('session-expert-task-')
}

export function registerTriggerHooks(ctx, library, { consultState } = {}) {
  if (typeof ctx?.on !== 'function') return () => {}

  const offPre = ctx.on('agent/pre-step', async (payload, next) => {
    const decision = await next()
    if (decision?.kind !== 'enter') return decision

    const { mode } = await readSettings(library.root).catch(() => ({ mode: 'on-request' }))
    if (mode === 'off') return decision

    const agent = payload?.agent
    const agentId = agentIdOf(agent)
    if (isChildTask(agentId)) return decision
    const text = lastUserText(decision.messages)
    if (!text) return decision
    // 插件自己写进去的派发 prompt / 工作区简报不该被当成用户提问。
    if (/专家 id：|工作区简报|^你是「/.test(text)) return decision
    if (alreadyConsulted(consultState, agentId)) return decision

    const rows = await rowsOf(library)
    if (mode === 'auto' && !shouldRemind(text)) return decision
    const hit = mode === 'auto' ? keywordHit(text, rows) : explicitHit(text, rows)
    if (!hit) return decision

    const turn = Number(payload?.turn ?? 0)
    if (reminded.get(agentId) === turn) return decision
    const now = Date.now()
    const last = lastRemindAt.get(agentId) ?? 0
    if (now - last < REMIND_COOLDOWN_MS) return decision
    reminded.set(agentId, turn)
    lastRemindAt.set(agentId, now)

    const reason = mode === 'auto' ? `命中「${hit.word}」` : `你点名要查「${hit.word}」`
    const reminder = notice(
      `<system-reminder>这轮问题属于「${hit.title}」（${reason}）。` +
        `先调 \`lookup_expert_knowledge\`（expert: "${hit.expertId}"）查资料库，命中后再按资料回答；` +
        '不要只凭记忆写。' +
        '若你另做了联网或实测调研、得到库里没有的结论，答复后把它写成一份资料存进该专家的 references/ 并在 index.md 登记，别让它只留在对话里。' +
        '</system-reminder>',
      `expert reminder: ${hit.expertId}`,
    )
    await library
      .appendTrace({ session: agentId, kind: 'remind', expert: hit.expertId, chars: reminder.content[0].text.length })
      .catch(() => {})
    return { ...decision, messages: [...decision.messages, reminder] }
  })

  return () => {
    offPre?.()
  }
}
