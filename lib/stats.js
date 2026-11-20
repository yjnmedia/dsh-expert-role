/** 把 trace.jsonl 聚合成面板要的统计结构：日/周趋势、热力图、主题占比、资料热度、未用清单。 */
import { isResearchSession } from './library.js'

const DAY_MS = 86_400_000
const READ_KINDS = new Set(['ref_read', 'skill_load'])

function dayKeyOf(ms) {
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function startOfDay(ms) {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function expertOfPath(path) {
  const parts = String(path ?? '').split(/[\\/]+/).filter(Boolean)
  return parts.length > 1 ? parts[0] : ''
}

function fileKeyOf(entry) {
  if (entry.path) return String(entry.path)
  return String(entry.expert ?? '')
}

/**
 * @param {import('./library.js').ExpertLibrary} library
 * @param {{ days?: number, expert?: string, now?: number }} options
 */
export async function computeStats(library, options = {}) {
  const days = Math.min(365, Math.max(1, Number(options.days) || 30))
  const now = Number(options.now) || Date.now()
  const todayStart = startOfDay(now)
  const windowStart = todayStart - (days - 1) * DAY_MS
  const weekStart = todayStart - 6 * DAY_MS
  const heatStart = todayStart - 55 * DAY_MS

  const all = await library.traceTail(5000)
  const entries = options.expert ? all.filter((entry) => entry.expert === options.expert || expertOfPath(entry.path) === options.expert) : all

  const daily = new Map()
  for (let i = 0; i < days; i++) {
    daily.set(dayKeyOf(windowStart + i * DAY_MS), { day: dayKeyOf(windowStart + i * DAY_MS), reads: 0, writes: 0 })
  }
  const heat = new Map()
  const perExpert = new Map()
  const perFile = new Map()
  const sessions = new Set()
  let usesInWindow = 0
  let readsThisWeek = 0
  let writesThisWeek = 0

  for (const entry of entries) {
    const ms = Date.parse(entry.ts)
    if (!Number.isFinite(ms)) continue
    const read = READ_KINDS.has(entry.kind)
    const write = entry.kind === 'write' || entry.kind === 'plan' || entry.kind === 'merge'
    if (!read && !write) continue
    // 调研子会话是「造资料的人」，不算使用
    if (isResearchSession(entry.session)) continue
    const key = dayKeyOf(ms)
    const bucket = daily.get(key)
    if (bucket) {
      if (read) bucket.reads += 1
      if (write) bucket.writes += 1
    }
    if (read) {
      usesInWindow += 1
      heat.set(key, (heat.get(key) ?? 0) + 1)
      if (ms >= weekStart) readsThisWeek += 1
      const expertId = entry.expert || expertOfPath(entry.path)
      if (expertId) {
        const item = perExpert.get(expertId) ?? { id: expertId, uses: 0, lastAt: '' }
        item.uses += 1
        if (!item.lastAt || String(entry.ts) > item.lastAt) item.lastAt = String(entry.ts)
        perExpert.set(expertId, item)
      }
      const fileKey = fileKeyOf(entry)
      const file = perFile.get(fileKey) ?? { path: fileKey, expert: expertId, uses: 0, chars: 0, lastAt: '' }
      file.uses += 1
      if (Number(entry.chars) > 0) file.chars = Math.max(file.chars, Number(entry.chars))
      if (!file.lastAt || String(entry.ts) > file.lastAt) file.lastAt = String(entry.ts)
      perFile.set(fileKey, file)
      if (entry.session) sessions.add(entry.session)
    }
    if (write && ms >= weekStart) writesThisWeek += 1
  }

  const experts = await library.listExperts()
  const titles = new Map(experts.map((expert) => [expert.id, expert.title || expert.id]))
  for (const item of perExpert.values()) item.title = titles.get(item.id) ?? item.id
  for (const file of perFile.values()) file.title = titles.get(file.expert) ?? file.expert
  const technical = /(^|[/\\])(SKILL\.md|manifest\.json|survey\.md|index\.md)$/i
  const unused = []
  let fileTotal = 0
  for (const expert of experts) {
    if (options.expert && expert.id !== options.expert) continue
    const files = await library.listFiles(expert.id).catch(() => [])
    for (const file of files) {
      if (technical.test(file.path)) continue
      fileTotal += 1
      const key = file.path
      if (!perFile.has(key)) unused.push({ path: key, expert: expert.id, bytes: file.bytes, updatedAt: file.updatedAt })
    }
  }

  const recent = entries
    .filter((entry) => READ_KINDS.has(entry.kind) || entry.kind === 'write')
    .slice(-25)
    .reverse()
    .map((entry) => ({
      ts: entry.ts,
      kind: entry.kind,
      expert: entry.expert ?? expertOfPath(entry.path),
      path: entry.path ?? '',
      chars: Number(entry.chars ?? 0),
      session: entry.session ?? '',
      durationMs: Number(entry.durationMs ?? 0),
    }))

  const heatDays = []
  for (let i = 0; i < 56; i++) {
    const day = dayKeyOf(heatStart + i * DAY_MS)
    heatDays.push({ day, count: heat.get(day) ?? 0 })
  }

  return {
    root: library.root,
    days,
    totals: {
      readsThisWeek,
      writesThisWeek,
      readsInWindow: usesInWindow,
      sessions: sessions.size,
      expertsUsed: perExpert.size,
      expertsTotal: experts.length,
      filesTotal: fileTotal,
      unusedFiles: unused.length,
    },
    daily: [...daily.values()],
    heat: heatDays,
    today: { day: dayKeyOf(todayStart), reads: daily.get(dayKeyOf(todayStart))?.reads ?? 0 },
    perExpert: [...perExpert.values()].sort((a, b) => b.uses - a.uses).slice(0, 8),
    perFile: [...perFile.values()]
      .filter((file) => !technical.test(file.path))
      .sort((a, b) => b.uses - a.uses)
      .slice(0, 10),
    unused: unused.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0, 20),
    recent,
  }
}
