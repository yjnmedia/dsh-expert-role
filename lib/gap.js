/**
 * 资料缺口（用户 2026-11-17 定）：现存资料到底能不能回答当前问题。
 *
 * 口径：自测命中率打底 + 运行时「查空」累计——
 *  - 自测：references/queries.md 里每题应有命中，命中数 / 题数
 *  - 运行时：expert_find / lookup_expert_knowledge 返回 missing 的次数，算进分母、不算命中
 * 缺口 = 1 - 命中 / (自测题数 + 运行时查空次数)。
 */
import { readSettings } from './settings.js'

export const GAP_OPTIONS = [0.1, 0.2, 0.3, 0.5]
export const DEFAULT_GAP = 0.2

/** trace 里某专家「运行时没查到」的次数。 */
export function runtimeMisses(trace, expertId) {
  if (!expertId) return 0
  return (trace ?? []).filter((entry) => entry && entry.kind === 'miss' && entry.expert === expertId).length
}

/** trace 里某专家「最后一次补资料之后」又没查到的次数。 */
export function runtimeMissesSince(trace, expertId, sinceIso) {
  if (!expertId || !sinceIso) return runtimeMisses(trace, expertId)
  return (trace ?? []).filter(
    (entry) => entry && entry.kind === 'miss' && entry.expert === expertId && String(entry.ts ?? '') > sinceIso,
  ).length
}

/**
 * 算出某位专家的缺口与分项，供面板与提示共用。
 * @param {{sinceIso?: string}} [options] 传了 sinceIso 时，「补后」次数单独给 openMisses。
 */
export function gapOf(expert, trace, options = {}) {
  const queries = expert?.maturity?.queries
  const misses = runtimeMisses(trace, expert?.id)
  const sinceIso = typeof options.sinceIso === 'string' ? options.sinceIso : ''
  const openMisses = sinceIso ? runtimeMissesSince(trace, expert?.id, sinceIso) : misses
  const total = Number(queries?.total ?? 0) + misses
  const hit = Number(queries?.hit ?? 0)
  return {
    gap: total > 0 ? Math.min(1, Math.max(0, 1 - hit / total)) : 0,
    total,
    hit,
    misses,
    openMisses,
    sinceIso,
    resolved: Boolean(sinceIso) && openMisses === 0 && misses > 0,
    known: total > 0,
  }
}

export function percentOf(value) {
  return `${Math.round(value * 100)}%`
}

/** 会话里插的那行提示：说清缺口、来源、怎么补。 */
export function gapNoticeText(expertId, expert, info, threshold) {
  const title = expert?.title || expertId
  const parts = []
  if (info.hit || info.total) parts.push(`自测 ${info.total - info.misses} 题里命中 ${info.hit} 题`)
  if (info.misses > 0) parts.push(`另有 ${info.misses} 次运行时没查到`)
  return (
    `📚 专家：「${title}」这个库现在有 ${percentOf(info.gap)} 的问题答不上来` +
    (parts.length ? `（${parts.join('，')}）` : '') +
    `，已超过设定阈值 ${percentOf(threshold)}。面板首页「需要补的资料」里有清单（含最近没查到的问题）；要我补就说「补」，我派子智能体去查。`
  )
}

/** 读一次阈值（坏值退回默认）。 */
export async function gapThresholdOf(root) {
  const settings = await readSettings(root)
  const value = Number(settings?.gap)
  return Number.isFinite(value) && value > 0 && value <= 0.9 ? value : DEFAULT_GAP
}

/** 某专家最近「没查到的提问」文本（最多 3 条，去重）。 */
export function missQueriesOf(trace, expertId, limit = 3) {
  if (!expertId) return []
  const seen = new Set()
  const out = []
  for (let i = (trace ?? []).length - 1; i >= 0; i--) {
    const entry = trace[i]
    if (!entry || entry.kind !== 'miss' || entry.expert !== expertId) continue
    const query = String(entry.query ?? '').trim()
    if (!query || seen.has(query)) continue
    seen.add(query)
    out.push(query)
    if (out.length >= limit) break
  }
  return out
}

/**
 * 面板「需要补的资料」清单（用户 2026-11-17 要求：缺口必须让用户在首页看到，不能只靠会话里转述）。
 * 只列真有过缺口（运行时查空，或自测没命中）的专家，按缺口从大到小排。
 */
export function gapRows(experts, trace, threshold = DEFAULT_GAP) {
  const rows = []
  for (const expert of experts ?? []) {
    const info = expert?.gap ?? gapOf(expert, trace)
    const queries = expert?.maturity?.queries
    const selfMisses = Number(queries?.misses?.length ?? 0)
    if (!info.misses && !selfMisses) continue
    rows.push({
      id: expert.id,
      title: expert.title || expert.id,
      gap: info.gap,
      misses: info.misses,
      examples: missQueriesOf(trace, expert.id),
      selfMissed: Array.isArray(queries?.misses) ? queries.misses.slice(0, 3) : [],
      overThreshold: info.gap >= threshold,
    })
  }
  return rows.sort((a, b) => b.gap - a.gap || b.misses - a.misses)
}
