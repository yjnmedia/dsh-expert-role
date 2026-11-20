// 查库自检：把每次检索的结果落盘，并标出四类「可能出错」。
// 全部在插件进程内完成，不依赖任何后台服务。
import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const AUDIT_FILE = join('.trace', 'retrieval.jsonl')
export const AUDIT_LIMIT = 2000
export const RISK_REASONS = ['empty', 'low', 'close', 'cross']
export const RISK_LABELS = {
  empty: '一份都没找到',
  low: '分数太低，多半库里没有',
  close: '前两名分差太小，容易选错',
  cross: '跨了专家，且分差很小',
}
// 判定阈值集中放这里，方便以后按实际数据调。
export const THRESHOLDS = { low: 0.5, close: 0.01, cross: 0.05 }

export function classifyRetrieval(record, thresholds = THRESHOLDS) {
  const top = Array.isArray(record?.top) ? record.top : []
  if (top.length === 0) return ['empty']
  const reasons = []
  const first = top[0]
  const second = top[1]
  if (Number(first.score) < thresholds.low) reasons.push('low')
  if (second && Number(first.score) - Number(second.score) < thresholds.close) reasons.push('close')
  if (
    second &&
    first.expert &&
    second.expert &&
    first.expert !== second.expert &&
    Number(first.score) - Number(second.score) < thresholds.cross
  ) {
    reasons.push('cross')
  }
  return reasons
}

export function auditPath(root) {
  return join(root, AUDIT_FILE)
}

export async function recordRetrieval(root, record) {
  const reasons = classifyRetrieval(record)
  const entry = {
    ts: record.ts ?? new Date().toISOString(),
    session: record.session ?? '',
    query: String(record.query ?? '').slice(0, 300),
    expert: record.expert ?? null,
    top: (record.top ?? []).slice(0, 5).map((item) => ({
      expert: item.expert ?? '',
      title: String(item.title ?? '').slice(0, 80),
      rel: item.rel ?? '',
      score: Number(Number(item.score ?? 0).toFixed(4)),
    })),
    reasons,
  }
  try {
    await mkdir(join(root, '.trace'), { recursive: true })
    await appendFile(auditPath(root), JSON.stringify(entry) + '\n', 'utf8')
  } catch {
    // 自检记录失败不影响正常检索
  }
  return entry
}

export async function readRetrieval(root, limit = 200) {
  let text = ''
  try {
    text = await readFile(auditPath(root), 'utf8')
  } catch {
    return []
  }
  const lines = text.split('\n').filter(Boolean)
  const rows = []
  for (const line of lines.slice(-Math.max(1, Math.min(limit, AUDIT_LIMIT)))) {
    try {
      rows.push(JSON.parse(line))
    } catch {
      // 跳过坏行
    }
  }
  return rows.reverse() // 最新在前
}

export function summarizeRetrieval(rows, { days = 7, now = Date.now() } = {}) {
  const since = now - days * 24 * 60 * 60 * 1000
  const inWindow = rows.filter((row) => Date.parse(row.ts) >= since)
  const byReason = Object.fromEntries(RISK_REASONS.map((reason) => [reason, 0]))
  let risky = 0
  for (const row of inWindow) {
    const reasons = Array.isArray(row.reasons) ? row.reasons : []
    if (reasons.length > 0) risky += 1
    for (const reason of reasons) if (reason in byReason) byReason[reason] += 1
  }
  return {
    days,
    total: inWindow.length,
    risky,
    rate: inWindow.length ? risky / inWindow.length : 0,
    byReason,
  }
}
