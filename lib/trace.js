import { relative, resolve, sep } from 'node:path'
import { randomUUID } from 'node:crypto'
import { gapOf, gapNoticeText, gapThresholdOf } from './gap.js'

const READ_TOOLS = new Set([
  'read',
  'ops_read_files',
  'ops_inspect_local_file',
  'grep',
  'ops_grep',
  'glob',
  'ops_glob',
  'ops_stat',
])
const WRITE_TOOLS = new Set([
  'write',
  'edit',
  'ops_write_file',
  'ops_edit_file',
  'ops_replace',
  'ops_move',
  'ops_copy',
  'ops_remove',
])
const SUBAGENT_TOOLS = new Set(['subagent', 'subagent_fork'])
const SHELL_TOOLS = new Set(['bash', 'ops_bash', 'pwsh', 'shell'])
const READ_VERBS = /(^|[\s;&|(])(cat|type|head|tail|sed|grep|rg|findstr|more|get-content|select-string|less)\b/i
const UUID = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i

function sessionIdOf(exec) {
  const agent = exec?.agent
  return String(
    agent?.session?.id ??
      agent?.sessionId ??
      agent?.id ??
      exec?.session?.id ??
      exec?.sessionId ??
      'unknown',
  )
}

/** 会话 id 归一到 uuid：`session-expert-task-<uuid>` 与裸 `<uuid>` 视为同一个会话。 */
export function sessionUuidOf(id) {
  const match = UUID.exec(String(id ?? ''))
  return match ? match[1].toLowerCase() : ''
}

/** 从命令行里找出指向专家库的路径（把库根当前缀，切出紧跟其后的第一段）。 */
function expertPathsInCommand(command, root) {
  const text = String(command ?? '').replace(/\\/g, '/')
  const rootNorm = String(root ?? '').replace(/\\/g, '/').toLowerCase()
  if (!rootNorm) return { ids: [], files: [] }
  const lower = text.toLowerCase()
  const ids = []
  const files = []
  let from = 0
  while (true) {
    const at = lower.indexOf(rootNorm, from)
    if (at === -1) break
    const rest = text.slice(at + rootNorm.length + 1)
    const match = /^([^"'`\s;|&)]+)/.exec(rest)
    if (match) {
      const partial = match[1]
      files.push(partial)
      ids.push(partial.split('/')[0])
    }
    from = at + rootNorm.length
  }
  return { ids, files }
}

function collectPaths(args) {
  const paths = []
  if (typeof args?.path === 'string') paths.push(args.path)
  if (typeof args?.file_path === 'string') paths.push(args.file_path)
  if (Array.isArray(args?.files)) {
    for (const item of args.files) {
      if (typeof item === 'string') paths.push(item)
      else if (typeof item?.path === 'string') paths.push(item.path)
    }
  }
  if (Array.isArray(args?.paths)) for (const item of args.paths) if (typeof item === 'string') paths.push(item)
  return paths
}

function resultSize(result) {
  if (typeof result === 'string') return result.length
  if (result == null) return 0
  try {
    return JSON.stringify(result).length
  } catch {
    return 0
  }
}

function formatBadge(entry) {
  const size = Number.isFinite(entry?.chars)
    ? entry.chars < 1024
      ? `${entry.chars} 字`
      : `${Math.round(entry.chars / 1024)}K 字`
    : ''
  if (entry.kind === 'skill_load') return `📚 专家：${entry.expert} · 加载技能 ${entry.skill}${size ? `（${size}）` : ''}`
  if (entry.kind === 'ref_read') return `📚 专家：${entry.expert} · 读 ${entry.path}${size ? `（${size}）` : ''}`
  return undefined
}

function badgeMessage(entry) {
  const text = formatBadge(entry)
  if (!text) return undefined
  return {
    id: randomUUID(),
    role: 'user',
    content: [{ type: 'text', text }],
    source: { kind: 'expert-role', form: 'notice', summary: text },
  }
}

/** 本进程内「哪些会话已经查过专家库」——由 trace 钩子写，供主动提醒去重。 */
export const consultState = new Map()

/** 缺口提醒的去重表：一位专家 24 小时内只提一次，别变成每轮都念。 */
const gapNotified = new Map()
const GAP_QUIET_MS = 24 * 60 * 60 * 1000

async function gapNoticeFor(entry, library) {
  if (!entry?.expert) return undefined
  const last = gapNotified.get(entry.expert) ?? 0
  if (Date.now() - last < GAP_QUIET_MS) return undefined
  const expert = await library.readExpert(entry.expert).catch(() => null)
  if (!expert?.maturity?.queries) return undefined
  const threshold = await gapThresholdOf(library.root)
  const trace = await library.traceTail(5000)
  const info = gapOf(expert, trace)
  if (!info.known || info.gap < threshold) return undefined
  gapNotified.set(entry.expert, Date.now())
  const text = gapNoticeText(entry.expert, expert, info, threshold)
  return {
    id: randomUUID(),
    role: 'user',
    content: [{ type: 'text', text }],
    source: { kind: 'expert-role', form: 'notice', summary: text },
  }
}

/** 观察工具调用，写入 trace.jsonl（可视化与调试的唯一事实来源），并在会话里插入一行提示。 */
export { formatBadge }

export function registerTraceHooks(ctx, library) {
  return ctx.effect(
    () =>
      ctx.on('tools/post-execute', async (exec, result, next) => {
        let badge
        let gapNotice
        try {
          const entry = await describe(exec, result, library)
          if (entry) {
            if (entry.kind === 'skill_load' || entry.kind === 'ref_read') {
              consultState.set(entry.session, { expert: entry.expert, at: Date.now() })
            }
            await library.appendTrace(entry)
            badge = badgeMessage(entry)
            gapNotice = await gapNoticeFor(entry, library)
          }
        } catch {
          /* 观测失败不能影响工具本身 */
        }
        const downstream = await next()
        const notices = [badge, gapNotice].filter(Boolean)
        if (notices.length === 0) return downstream
        const additionalContexts = [...notices, ...(downstream?.additionalContexts ?? [])]
        return { ...downstream, additionalContexts }
      }),
    'expert-role.trace',
  )
}

async function describe(exec, result, library) {
  const name = String(exec?.name ?? '')
  if (!name || name.startsWith('expert_')) return undefined
  const args = exec?.arguments ?? {}
  const session = sessionIdOf(exec)
  const chars = resultSize(result)
  const durationMs = Number.isFinite(exec?.durationMs) ? exec.durationMs : undefined

  if (name === 'skill') {
    const skillName = String(args?.name ?? '')
    if (!skillName.startsWith('expert-')) return undefined
    return { session, kind: 'skill_load', expert: skillName.slice('expert-'.length), skill: skillName, chars, durationMs }
  }

  if (SUBAGENT_TOOLS.has(name)) {
    const prompt = String(args?.prompt ?? '')
    const experts = await library.listExpertIds()
    const hit = experts.find((id) => prompt.includes(id) || prompt.includes(`AIExperts${sep}${id}`) || prompt.includes(`AIExperts/${id}`))
    if (!hit) return undefined
    return { session, kind: 'subagent', expert: hit, chars: prompt.length, durationMs }
  }

  if (SHELL_TOOLS.has(name)) {
    const command = String(args?.command ?? '')
    const found = expertPathsInCommand(command, library.root)
    const index = found.ids.findIndex((id) => /^[a-z0-9][a-z0-9-]*$/i.test(id))
    if (index < 0) return undefined
    const expert = found.ids[index]
    const writing = /(>>?|(set-content|out-file|new-item|copy-item|move-item|remove-item|rm\s+-|mv\s|cp\s|del\s|rmdir))/i.test(command)
    if (writing) return undefined
    if (!READ_VERBS.test(command)) return undefined
    const filePart = found.files[index] ?? expert
    return {
      session,
      sessionUuid: sessionUuidOf(session),
      kind: 'ref_read',
      expert,
      path: filePart.split(sep).join('/'),
      tool: name,
      chars,
      durationMs,
    }
  }

  if (READ_TOOLS.has(name) || WRITE_TOOLS.has(name)) {
    const hits = []
    for (const raw of collectPaths(args)) {
      const abs = resolve(raw)
      const expert = await library.expertOfPath(abs)
      if (!expert) continue
      hits.push({ expert, path: relative(library.root, abs).split(sep).join('/') })
    }
    if (hits.length === 0) return undefined
    return {
      session,
      kind: WRITE_TOOLS.has(name) ? 'write' : 'ref_read',
      expert: hits[0].expert,
      path: hits[0].path,
      paths: hits.map((hit) => hit.path),
      tool: name,
      chars,
      durationMs,
    }
  }

  return undefined
}
