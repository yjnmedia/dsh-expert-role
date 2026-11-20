/**
 * 源码与资料的「可信度分级」登记。
 *
 * 为什么不复制代码：源码会变、会膨胀；只登记绝对路径 + 用途 + 级别，
 * 需要时按路径去读，读到哪一行就是哪一行的当前状态。
 *
 * 五级（用户 2026-11-18 定）：S > A > B > C > D
 *   S  用户本人确认过的自有项目源码（每天在用、逐项验收过）
 *   A  实际复用过的第三方源码（有引用痕迹，读过并改过）
 *   B  收集但没用过（只存档，不作依据）
 *   C  文档 / 博客 / 调研资料（资料库现有主体）
 *   D  模型推测、未验证（不进库；回答里必须标「推测」）
 */

export const SOURCE_LEVELS = ['S', 'A', 'B', 'C', 'D']

export const LEVEL_LABELS = {
  S: '自有项目源码（本人确认）',
  A: '复用过的第三方源码',
  B: '收集未用过的源码',
  C: '文档与调研资料',
  D: '推测未验证',
}

export const LEVEL_RANK = { S: 0, A: 1, B: 2, C: 3, D: 4 }

/** 回答里引用时的权重：S 最高。 */
export function weightOf(level) {
  return ({ S: 4, A: 3, B: 1, C: 2, D: 0.5 })[level] ?? 1
}

export function normalizeSource(input) {
  if (!input || typeof input !== 'object') return null
  const path = String(input.path ?? '').trim()
  const level = String(input.level ?? '').trim().toUpperCase()
  if (!path) return null
  if (!SOURCE_LEVELS.includes(level)) return null
  return {
    path,
    level,
    use: String(input.use ?? '').trim(),
    lines: Number.isFinite(Number(input.lines)) ? Number(input.lines) : null,
    verifiedAt: String(input.verifiedAt ?? '').trim(),
    note: String(input.note ?? '').trim(),
  }
}

/** 读 manifest.sources，过滤非法项并按级别排序（S 在前）。 */
export function sourcesOf(expert) {
  const rows = Array.isArray(expert?.sources) ? expert.sources : []
  return rows
    .map(normalizeSource)
    .filter(Boolean)
    .sort((a, b) => (LEVEL_RANK[a.level] ?? 9) - (LEVEL_RANK[b.level] ?? 9) || a.path.localeCompare(b.path))
}

export function renderSources(sources) {
  const rows = Array.isArray(sources) ? sources : []
  if (rows.length === 0) return ''
  const head = '| 级别 | 源码路径 | 用途 | 行数 | 最近核实 |'
  const sep = '|---|---|---|---|---|'
  const body = rows.map((s) => `| ${s.level} | \`${s.path}\` | ${s.use || '—'} | ${s.lines ?? '—'} | ${s.verifiedAt || '—'} |`)
  return [head, sep, ...body].join('\n')
}
