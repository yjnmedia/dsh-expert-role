// 「同意去查」之后的真调研：投进该大类已有的会话，不新建任何会话。
// 只负责三件事：把大类映射到固定会话号、生成提示词、记下每个缺口的起止状态。
// 真正投递的动作留在 lib/index.js（那里才拿得到 ctx.agents）。
import { mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export const RUNS_FILE = join('.trace', 'research-runs.json')
export const MAX_RUNS = 200

/** 八个大类会话：调研只能投进这八条，不许新建。 */
export const CATEGORY_SESSIONS = Array.from({ length: 8 }, (_, i) => `session-expert-cat-${String(i + 1).padStart(2, '0')}`)

/** 第几类（1 起）→ 固定的会话号。 */
export function categorySessionId(order) {
  const n = Number(order)
  if (!Number.isInteger(n) || n < 1 || n > 8) return ''
  return CATEGORY_SESSIONS[n - 1]
}

/** 这个会话号是不是八个大类会话之一。 */
export function isCategorySession(sessionId) {
  return CATEGORY_SESSIONS.includes(String(sessionId ?? ''))
}

/** 一个缺口的稳定标识：专家 + 原话。 */
export function runIdentity(expert, key) {
  return `${String(expert ?? '')}\u0000${String(key ?? '')}`
}

/** 开场提示词：把「查什么、写到哪、怎么写」一次说清，避免它自由发挥。 */
export function researchPrompt({ expertId, expertDir, topic, key }) {
  const file = `${expertDir}\\references\\${slugOf(topic)}.md`
  return [
    `你这次只做一件事：把「${topic}」这件事查清楚，并把结论写成一份资料。`,
    '',
    `背景：这个词来自「${expertId}」专家资料库里一条模型答不上来的问题（原话：${key}）。`,
    `资料目录：${expertDir}`,
    '',
    '步骤：',
    '1. 先调 lookup_expert_knowledge 查这条，确认库里到底有没有；有就直接引用，不要重写。',
    '2. 库里没有就去查：优先官方文档与一手来源，命令行能验的就跑一遍。',
    '   跑命令注意：路径一律用带盘符的 Windows 写法（如 C:\\work\\tmp），不要用 /e/... 这种 MSYS 写法——浏览器和原生程序读不了，会弹「无法创建数据目录」；临时文件放到库根下的 .tmp 目录，用完删掉。',
    `3. 把结论写成 ${file}，结构固定：一句话结论 / 数值或事实 / 依据与链接 / 适用边界。`,
    '4. 在 references\\index.md 追加一行登记（文件名 + 一句话），再把这份资料补进 manifest.json 的 titles、summaries、queries。',
    '5. 跑 node scripts/expertctl.mjs doctor 确认登记没漏。',
    '',
    '回话按三段写（结论 / 证据 / 待办），最后一行写标记：不用人管就写【不用你看】；需要我拍板才写【要你看·花额度】。',
    '禁止：改别的专家目录；改设置；编造没有出处的数值。',
  ].join('\n')
}

/** 文件名里能用的 slug：去掉标点，留中文和字母数字。 */
export function slugOf(text) {
  const cleaned = String(text ?? '')
    .replace(/[\\/:*?"<>|\s]+/g, '-')
    .replace(/[，。；！？、（）【】「」]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return (cleaned || 'note').slice(0, 60)
}

/** 事件里的工具调用：callId + 名字 + 参数，用来判「卡住」和「原地打转」。 */
export function toolCalls(events) {
  const calls = []
  const done = new Set()
  for (const event of events || []) {
    const data = event?.data ?? {}
    if (event?.type === 'tool/call') {
      calls.push({
        callId: String(data.callId ?? ''),
        name: String(data.name ?? ''),
        signature: `${data.name}\u0000${String(data.arguments ?? '')}`,
        time: Number(event.time ?? 0),
      })
    } else if (event?.type === 'tool/result') {
      const id = String(data.toolCallId ?? data?.message?.toolCallId ?? data?.message?.source?.callId ?? '')
      if (id) done.add(id)
      else if (calls.length) done.add(calls[calls.length - 1].callId)
    }
  }
  return { calls, done }
}

/** 最后一条助手正文（判「在等你回话」用）。 */
export function lastAssistantText(events) {
  for (let i = (events || []).length - 1; i >= 0; i -= 1) {
    const event = events[i]
    if (event?.type !== 'assistant/message') continue
    const blocks = event?.data?.content ?? event?.data?.message?.content ?? []
    const text = (Array.isArray(blocks) ? blocks : [])
      .filter((block) => block?.type === 'text')
      .map((block) => block.text || '')
      .join('')
      .trim()
    if (text) return text
  }
  return ''
}

/** 会话其实已经收尾了吗：最后一条是 turn/end（或者已经没有活 agent 且最后一轮走完了）。 */
export function turnFinished(events) {
  const list = Array.isArray(events) ? events : []
  if (!list.length) return false
  const last = list[list.length - 1]
  return last?.type === 'turn/end'
}

/** 收尾时间取回合结束那一刻，而不是我们补记的时间。 */
export function finishedAt(events) {
  const list = Array.isArray(events) ? events : []
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (list[i]?.type === 'turn/end' && list[i].time) return new Date(list[i].time).toISOString()
  }
  return new Date().toISOString()
}

const STUCK_MS = 90 * 1000
const IDLE_MS = 10 * 60 * 1000
const LOOP_WINDOW = 12
const LOOP_TIMES = 3

/**
 * 判断一次调研跑到哪一步了。先看结构（有没有人跑、等不等你、工具回不回来、是不是原地打转），
 * 时间只作为最后的兜底——工具卡住 90 秒、整个会话 10 分钟没动静。
 * @returns {{code: string, text: string, detail?: string, lastActivityAt?: number}}
 */
export function diagnoseRun(events, options = {}) {
  const now = Number(options.now ?? Date.now())
  const list = Array.isArray(events) ? events : []
  if (options.live === false) {
    return { code: 'orphaned', text: '没人在跑它了（进程重启或已中断）' }
  }
  if (list.length === 0) return { code: 'no-events', text: '还没有任何动静' }

  const last = list[list.length - 1]
  const lastActivityAt = Number(last?.time ?? 0) || undefined

  const tail = lastAssistantText(list)
  if (tail && /【要你看/.test(tail)) return { code: 'needs-you', text: '在等你回话', lastActivityAt }

  const { calls, done } = toolCalls(list)
  const pending = calls.filter((call) => call.callId && !done.has(call.callId))
  if (pending.length) {
    const oldest = pending[0]
    const waited = now - (oldest.time || now)
    if (waited > STUCK_MS) return { code: 'stuck-tool', text: `工具「${oldest.name}」没返回（已等 ${Math.round(waited / 1000)} 秒）`, detail: oldest.name, lastActivityAt }
  }

  const window = calls.slice(-LOOP_WINDOW)
  const seen = new Map()
  let loop = null
  for (const call of window) {
    const hit = seen.get(call.signature) || { count: 0, name: call.name }
    hit.count += 1
    seen.set(call.signature, hit)
    if (hit.count >= LOOP_TIMES) loop = hit
  }
  if (loop) return { code: 'looping', text: `反复调同一个工具「${loop.name}」${loop.count} 次`, detail: loop.name, lastActivityAt }

  const results = list.filter((event) => event?.type === 'tool/result').slice(-5)
  if (results.length === 5 && results.every((event) => event?.data?.error || event?.data?.message?.isError)) {
    return { code: 'failing', text: '连续 5 次工具报错，可能环境不对', lastActivityAt }
  }

  if (lastActivityAt && now - lastActivityAt > IDLE_MS) {
    return { code: 'idle', text: `${Math.round((now - lastActivityAt) / 60000)} 分钟没动静了`, lastActivityAt }
  }

  return { code: 'running', text: '在跑', lastActivityAt }
}

export async function readRuns(root) {
  try {
    const text = await readFile(join(root, RUNS_FILE), 'utf8')
    const list = JSON.parse(text)
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

async function saveRuns(root, runs) {
  const file = join(root, RUNS_FILE)
  await mkdir(join(root, '.trace'), { recursive: true })
  const tmp = file + '.tmp'
  await writeFile(tmp, JSON.stringify(runs.slice(-MAX_RUNS), null, 2), 'utf8')
  await rename(tmp, file)
}

/** 记一条开始；同一个缺口已有记录就覆盖（重启后再点不算新开一条）。 */
export async function markRunStarted(root, run) {
  const runs = await readRuns(root)
  const id = runIdentity(run.expert, run.key)
  const next = runs.filter((item) => runIdentity(item.expert, item.key) !== id)
  next.push({ ...run, status: 'running' })
  await saveRuns(root, next)
  return next
}

/** 记一条结束：优先按缺口定位；只给了大类会话号时，收尾那条最老的「在跑」。 */
export async function markRunEnded(root, { sessionId = '', expert = '', key = '', status = 'done', error = '', files = [], added = 0, registered = false, verifiedAt = '' }) {
  const runs = await readRuns(root)
  const endedAt = new Date().toISOString()
  let index = -1
  if (expert && key) index = runs.findIndex((item) => runIdentity(item.expert, item.key) === runIdentity(expert, key))
  if (index < 0 && sessionId) index = runs.findIndex((item) => item.sessionId === sessionId && item.status === 'running')
  if (index < 0 && sessionId) index = runs.findIndex((item) => item.sessionId === sessionId)
  const extra = { added: Number(added) || 0, registered: registered === true, verifiedAt: verifiedAt || '' }
  if (index < 0) {
    runs.push({ sessionId, expert, key, status, endedAt, error, files, ...extra })
  } else {
    runs[index] = { ...runs[index], status, endedAt, error, files: files.length ? files : runs[index].files ?? [], ...extra }
  }
  await saveRuns(root, runs)
  return runs
}

/**
 * 跑完之后核对：这次到底写了几份、登记齐没齐。
 * 不信任会话的自述，直接看磁盘：references 下 mtime >= startedAt 的新文件，
 * 再看它们有没有出现在 index.md 与 manifest.titles 里。
 */
export async function verifyResearch({ expertDir = '', startedAt = '', endedAt = '' } = {}) {
  const since = Date.parse(String(startedAt ?? ''))
  const until = Date.parse(String(endedAt ?? ''))
  if (!expertDir || !Number.isFinite(since)) return { added: 0, files: [], registered: false }
  const refs = join(expertDir, 'references')
  let names = []
  try {
    names = await readdir(refs, { recursive: true })
  } catch {
    return { added: 0, files: [], registered: false }
  }
  const picked = []
  for (const name of names) {
    const rel = String(name).replace(/\\/g, '/')
    if (!rel.endsWith('.md') || rel === 'index.md') continue
    let info
    try {
      info = await stat(join(refs, rel))
    } catch {
      continue
    }
    if (!info.isFile() || info.mtimeMs < since - 2000) continue
    if (Number.isFinite(until) && info.mtimeMs > until + 5000) continue
    picked.push(rel)
  }
  if (!picked.length) return { added: 0, files: [], registered: false }

  let indexText = ''
  try {
    indexText = await readFile(join(refs, 'index.md'), 'utf8')
  } catch {
    indexText = ''
  }
  let titles = {}
  try {
    titles = JSON.parse(await readFile(join(expertDir, 'manifest.json'), 'utf8'))?.titles ?? {}
  } catch {
    titles = {}
  }
  const keys = Object.keys(titles)
  const files = picked.map((rel) => ({
    rel,
    inIndex: Boolean(indexText) && (indexText.includes(rel) || indexText.includes(rel.replace(/\.md$/, ''))),
    inManifest: keys.some((key) => key === rel || key === 'references/' + rel || key.endsWith('/' + rel)),
  }))
  return { added: files.length, files, registered: files.every((item) => item.inIndex && item.inManifest) }
}

/** 面板用：把运行记录按缺口 key 摊开，方便逐行显示「正在查 · 几秒」。 */
export function runsToMap(runs) {
  const map = new Map()
  for (const run of runs || []) {
    if (!run?.sessionId) continue
    const id = String(run.key ?? '')
    if (!id) continue
    map.set(`${run.expert}\u0000${id}`, run)
  }
  return map
}

export function elapsedMs(run, now = Date.now()) {
  if (!run?.startedAt) return 0
  const end = run.endedAt ? Date.parse(run.endedAt) : now
  const start = Date.parse(run.startedAt)
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0
  return Math.max(0, end - start)
}


/** 正在跑调研的会话号集合：通知类消息要避开这些会话，否则会把那一轮挤掉。 */
export function busySessionIds(runs) {
  const out = new Set()
  for (const run of Array.isArray(runs) ? runs : []) {
    if (run && run.status === 'running' && run.sessionId) out.add(String(run.sessionId))
  }
  return out
}

/** 同一大类的排队上限，防误点堆几十条。 */
export const MAX_QUEUE = 20

/** 排队位置（1 起）；不在队列里返回 0。 */
export function queuePosition(runs, target) {
  const queue = (runs ?? [])
    .filter((item) => item?.sessionId === target?.sessionId && item?.status === 'queued')
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
  const idx = queue.findIndex((item) => runIdentity(item.expert, item.key) === runIdentity(target.expert, target.key))
  return idx < 0 ? 0 : idx + 1
}

/** 排进这一大类的队列。已经在跑或在排的同一缺口不再重复排。 */
export async function enqueueRun(root, run) {
  const runs = await readRuns(root)
  const id = runIdentity(run.expert, run.key)
  const existing = runs.find(
    (item) => runIdentity(item.expert, item.key) === id && (item.status === 'queued' || item.status === 'running'),
  )
  if (existing) return { runs, run: existing, position: queuePosition(runs, existing), already: true }

  const waiting = runs.filter((item) => item.sessionId === run.sessionId && item.status === 'queued')
  if (waiting.length >= MAX_QUEUE) {
    return { error: `这一类的排队已经 ${MAX_QUEUE} 条了，等它跑完几条再排` }
  }

  const order = runs.reduce((max, item) => Math.max(max, Number(item.order) || 0), 0) + 1
  const item = { ...run, status: 'queued', queuedAt: new Date().toISOString(), order }
  runs.push(item)
  await saveRuns(root, runs)
  return { runs, run: item, position: queuePosition(runs, item) }
}

/** 这一大类排队里的第一条（跑到谁就先跑谁）。 */
export async function nextQueued(root, sessionId) {
  const runs = await readRuns(root)
  const queue = runs
    .filter((item) => item?.sessionId === sessionId && item?.status === 'queued')
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
  return queue[0] ?? null
}

/** 取消排队：把这条从队列里拿掉（真在跑的用 markRunEnded 标失败）。 */
export async function dequeueRun(root, { expert = '', key = '' }) {
  const runs = await readRuns(root)
  const id = runIdentity(expert, key)
  const next = runs.filter((item) => !(runIdentity(item.expert, item.key) === id && item.status === 'queued'))
  if (next.length !== runs.length) await saveRuns(root, next)
  return { removed: runs.length - next.length }
}
