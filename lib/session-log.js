// 收大类会话的每一轮：8 个「NN 大类」会话是插件的辅助子智能体，用户平时不看。
// 这里只做两件事：把每轮结果收下来、存成可翻的历史（谁、哪一类、说了什么、用了几次工具）。
// 判定（要不要打扰用户、要不要落盘）不在这里做。

import { appendFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { zstdDecompressSync } from 'node:zlib'

export const SESSION_LOG_FILE = join('.trace', 'session-log.jsonl')

/** 建会话时的 id：console-expert-cat-01 … 08。 */
export const CATEGORY_SESSION = /^session-expert-cat-(\d{2})$/

const MAX_BYTES = 512 * 1024
const KEEP_LINES = 200
const TEXT_MAX = 4000

/** 从会话 id 取出大类序号；不是这 8 个会话就返回 0。 */
export function categoryIndexOf(sessionId) {
  const match = CATEGORY_SESSION.exec(String(sessionId ?? ''))
  if (!match) return 0
  const index = Number(match[1])
  return Number.isFinite(index) && index >= 1 && index <= 8 ? index : 0
}

/** 取一条助手消息的正文（事件形状：event.data.message.content）。 */
export function textOfAssistant(data) {
  const message = data?.message ?? data
  const content = Array.isArray(message?.content) ? message.content : []
  return content
    .filter((item) => item?.type === 'text')
    .map((item) => String(item.text ?? ''))
    .join('\n')
    .trim()
}

/** 回话末尾的固定标记：要你看 / 不用你看。 */
export const NEED_MARKER = /【要你看[·・:：]?\s*([^】]*)】/
export const NO_MARKER = /【不用你看】/

const NEED_KIND = {
  花额度: 'spend',
  改别类: 'cross',
  新建专家: 'new-expert',
  其他: 'other',
}

/**
 * 判一条回话要不要交给人看。
 * 优先认标记；没有标记的（老数据）用保守关键词兜底，宁可少报。
 */
export function judgeNeeds(text) {
  const value = String(text ?? '')
  if (NO_MARKER.test(value)) return { need: false, kind: '', reason: '' }
  const marked = NEED_MARKER.exec(value)
  if (marked) {
    const label = String(marked[1] ?? '').trim()
    const key = Object.keys(NEED_KIND).find((name) => label.includes(name))
    const after = value.slice(marked.index + marked[0].length).split(/\r?\n/)[0].trim()
    return {
      need: true,
      kind: key ? NEED_KIND[key] : 'other',
      reason: after.slice(0, 80) || label.slice(0, 80),
    }
  }
  const rules = [
    { kind: 'spend', re: /要花额度|需要额度|要不要(我)?(去)?(查|补)|开(一个|个)?新(的)?(工作区|会话)|同意去查/ },
    { kind: 'cross', re: /(改|写|补)(别的|其他|别位)专家|跨(类|专家)|不属于我(这一)?类/ },
    { kind: 'new-expert', re: /(新建|建一个|增加)一个?专家|expert_create/ },
  ]
  for (const rule of rules) {
    if (rule.re.test(value)) return { need: true, kind: rule.kind, reason: '' }
  }
  return { need: false, kind: '', reason: '' }
}

/** 把判定结果摊成落盘字段（kind 这个键留给 category-turn）。 */
export function judgeFields(judge) {
  return { need: Boolean(judge?.need), needKind: judge?.kind ?? '', reason: judge?.reason ?? '' }
}

function clip(text, n = TEXT_MAX) {
  const value = String(text ?? '')
  return value.length > n ? `${value.slice(0, n)}…` : value
}

/** 追加一条；文件太大时只留最近若干行，避免无限长。 */
export async function appendSessionLog(root, entry) {
  const file = join(root, SESSION_LOG_FILE)
  await mkdir(join(root, '.trace'), { recursive: true })
  const info = await stat(file).catch(() => null)
  if (info && info.size > MAX_BYTES) {
    const text = await readFile(file, 'utf8').catch(() => '')
    const lines = text.split(/\r?\n/).filter(Boolean)
    await writeFile(file, `${lines.slice(-KEEP_LINES).join('\n')}\n`, 'utf8')
  }
  const line = JSON.stringify({ ...entry, ts: entry?.ts ?? new Date().toISOString(), kind: 'category-turn' })
  await appendFile(file, `${line}\n`, 'utf8')
  return line
}

/** 读最近若干条，最新在前。 */
export async function readSessionLog(root, { limit = 200 } = {}) {
  const file = join(root, SESSION_LOG_FILE)
  const text = await readFile(file, 'utf8').catch(() => '')
  const lines = text.split(/\r?\n/).filter(Boolean)
  const slice = lines.slice(Math.max(0, lines.length - limit))
  return slice
    .map((line) => {
      try {
        return JSON.parse(line)
      } catch {
        return null
      }
    })
    .filter((entry) => entry && entry.kind === 'category-turn')
    .map((entry) => (entry.need === undefined ? { ...entry, ...judgeFields(judgeNeeds(entry.text)) } : entry))
    .reverse()
}

/**
 * 盯着这 8 个会话：收助手正文与工具次数，一轮结束时落一条。
 * 只处理这 8 个 id，其余会话的事件直接跳过。
 */
export function watchCategorySessions(ctx, { root }) {
  const buffered = new Map()

  const gain = (sessionId) => {
    if (!buffered.has(sessionId)) buffered.set(sessionId, { cat: categoryIndexOf(sessionId), texts: [], tools: 0 })
    return buffered.get(sessionId)
  }

  const offEvent = ctx.on('session/event', (session, event) => {
    try {
      const sessionId = String(session?.header?.id ?? session?.id ?? '')
      if (!categoryIndexOf(sessionId)) return
      if (event?.type === 'assistant/message') {
        const text = textOfAssistant(event.data)
        if (text) gain(sessionId).texts.push(text)
        return
      }
      if (event?.type === 'tool/call') {
        gain(sessionId).tools += 1
      }
    } catch {
      // 收集失败不影响会话本身
    }
  })

  const offStop = ctx.on('agent/turn-stopping', ({ agent }) => {
    try {
      const sessionId = String(agent?.id ?? agent?.session?.id ?? '')
      if (!categoryIndexOf(sessionId)) return
      const bucket = buffered.get(sessionId)
      if (!bucket) return
      const text = bucket.texts.join('\n\n').trim()
      const tools = bucket.tools
      buffered.delete(sessionId)
      if (!text) return
      const judge = judgeNeeds(text)
      appendSessionLog(root, {
        session: sessionId,
        cat: bucket.cat,
        chars: text.length,
        tools,
        text: clip(text),
        ...judgeFields(judge),
      }).catch(() => {})
    } catch {
      // 同上
    }
  })

  return () => {
    offEvent?.()
    offStop?.()
  }
}

// ---- 回填：把已经跑过的轮次补进历史（读会话落盘的 zstd 分帧日志） ----

const ZSTD_MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])

/** 一个 zstd 文件里是多帧追加的，逐帧解压后拼起来。 */
export function decodeZstdFrames(buffer) {
  const offsets = []
  let at = 0
  while (true) {
    const found = buffer.indexOf(ZSTD_MAGIC, at)
    if (found === -1) break
    offsets.push(found)
    at = found + 4
  }
  const parts = []
  for (let i = 0; i < offsets.length; i += 1) {
    const end = i + 1 < offsets.length ? offsets[i + 1] : buffer.length
    try {
      parts.push(zstdDecompressSync(buffer.subarray(offsets[i], end)))
    } catch {
      // 跳过坏帧
    }
  }
  return Buffer.concat(parts).toString('utf8')
}

/** 找到某个会话的落盘文件：<dshHome>/sessions/<任意>-<工作区>/<sessionId>/session.v4.jsonl.zstd */
export async function findSessionFile(dshHome, sessionId) {
  const root = join(dshHome, 'sessions')
  const dirs = await readdir(root).catch(() => [])
  for (const dir of dirs) {
    const file = join(root, dir, sessionId, 'session.v4.jsonl.zstd')
    const info = await stat(file).catch(() => null)
    if (info?.isFile()) return file
  }
  return ''
}

/** 从事件流里切出「一轮」：turn/start 到 turn/end 之间的助手正文与工具次数。 */
export function turnsFromEvents(events) {
  const turns = []
  let current = null
  for (const event of events) {
    if (event?.type === 'turn/start') {
      current = { texts: [], tools: 0, time: event.time }
      continue
    }
    if (!current) continue
    if (event?.type === 'assistant/message') {
      const text = textOfAssistant(event.data)
      if (text) current.texts.push(text)
      continue
    }
    if (event?.type === 'tool/call') {
      current.tools += 1
      continue
    }
    if (event?.type === 'turn/end') {
      const text = current.texts.join('\n\n').trim()
      if (text) {
        turns.push({
          text,
          tools: current.tools,
          ts: new Date(Number(event.time ?? current.time ?? Date.now())).toISOString(),
        })
      }
      current = null
    }
  }
  return turns
}

/**
 * 回填这 8 个会话已经跑过的轮次。按「会话 + 时间 + 字数」去重，重复调用不会重复写。
 * 返回 { added, scanned }。
 */
export async function backfillSessionLog(dshHome, root, { sessionIds } = {}) {
  const ids = (sessionIds ?? Array.from({ length: 8 }, (_, i) => `session-expert-cat-${String(i + 1).padStart(2, '0')}`))
    .filter((id) => categoryIndexOf(id))
  const existing = new Set()
  for (const entry of await readSessionLog(root, { limit: 500 })) {
    existing.add(`${entry.session}|${entry.ts}|${entry.chars}`)
  }
  let added = 0
  for (const id of ids) {
    const file = await findSessionFile(dshHome, id)
    if (!file) continue
    const raw = await readFile(file).catch(() => null)
    if (!raw) continue
    const events = decodeZstdFrames(raw)
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line)
        } catch {
          return null
        }
      })
      .filter(Boolean)
    for (const turn of turnsFromEvents(events)) {
      const key = `${id}|${turn.ts}|${turn.text.length}`
      if (existing.has(key)) continue
      existing.add(key)
      await appendSessionLog(root, {
        session: id,
        cat: categoryIndexOf(id),
        chars: turn.text.length,
        tools: turn.tools,
        text: clip(turn.text),
        ts: turn.ts,
        backfilled: true,
        ...judgeFields(judgeNeeds(turn.text)),
      })
      added += 1
    }
  }
  return { added, scanned: ids.length }
}
