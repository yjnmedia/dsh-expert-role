import { readdir, readFile, stat } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import { scoreQueries } from './queries.js'

/**
 * 资料库成熟度：六个维度加权 + 每档维度下限。
 * 六个维度的定义与实测依据见
 * D:\demo-workbench\.tmp\research-maturity\README.md（第 2、3 节）。
 * 这里只做计算，不改任何文件。
 */
export const TIERS = ['起步', '可用', '可靠', '权威', '标杆']

export const WEIGHTS = { D1: 0.2, D2: 0.2, D3: 0.15, D4: 0.15, D5: 0.2, D6: 0.1 }

/**
 * 内容分只看资料本身（结构/覆盖/内容/新鲜/闭环），使用情况单独算。
 * 这样「没人用过」不会把一座完整的资料库按成一星。
 */
export const CONTENT_WEIGHTS = { D1: 0.25, D2: 0.25, D3: 0.2, D4: 0.15, D6: 0.15 }
export const USAGE_WEIGHT = 0.15

/**
 * 前四星只看资料本身：起步/可用/可靠/权威。
 * 第五星「标杆」是额外的：内容已经到权威，并且真的被用过（使用分≥50、至少 2 个会话）。
 */
export const TIER_FLOORS = [
  { tier: 1, score: 58, dims: { D1: 0.7, D2: 0.4 } },
  { tier: 2, score: 72, dims: { D1: 0.85, D2: 0.6, D3: 0.6 } },
  { tier: 3, score: 86, dims: { D1: 0.9, D2: 0.75, D3: 0.7, D4: 0.7 } },
]
export const FIVE_STAR = { usageScore: 50, sessions: 2 }

export const DIM_NAMES = {
  D1: '结构完整度',
  D2: '覆盖均衡',
  D3: '内容可用度',
  D4: '新鲜度',
  D5: '真实使用',
  D6: '调研闭环',
}

export const STALE_DAYS = 365

const HALF_LIFE = {
  'ai-image': 90,
  'game-automation': 180,
  reader: 180,
  'dsh-plugin': 180,
  'ui-design': 365,
  'ai-drama': 365,
  player: 365,
}

const USE_HALF_LIFE = 30
const LARGE_ENOUGH = 8192
const WEAK_INDEX = ['| --- |', '资料本体都在这个专家目录下']
const TEXT_EXT = new Set(['.md', '.txt', '.json', '.csv', ''])

/** 前四星：只看总分与内容维下限，返回 0–3（对应起步–权威）。 */
export function tierOf(score, dims) {
  for (let i = TIER_FLOORS.length - 1; i >= 0; i -= 1) {
    const floor = TIER_FLOORS[i]
    if (score < floor.score) continue
    if (Object.entries(floor.dims).every(([key, min]) => (dims[key] ?? 0) >= min)) return floor.tier
  }
  return 0
}

/** 最终星级 1–5：前四星看内容，第五星再看使用。 */
export function levelOf(score, dims, facts = {}) {
  const content = tierOf(score, dims)
  if (content < 3) return content + 1
  const usedEnough = (facts.usageScore ?? 0) >= FIVE_STAR.usageScore && (facts.sessions ?? 0) >= FIVE_STAR.sessions
  return usedEnough ? 5 : 4
}

/** 离下一星还差什么：前四星看内容，第五星看使用。 */
export function blockersFor(score, dims, tier, facts = {}) {
  if (tier >= 3) {
    const blockers = []
    const usageScore = facts.usageScore ?? 0
    const sessions = facts.sessions ?? 0
    if (usageScore < FIVE_STAR.usageScore) blockers.push({ key: 'usageScore', need: FIVE_STAR.usageScore, value: usageScore, kind: 'usage' })
    if (sessions < FIVE_STAR.sessions) blockers.push({ key: 'sessions', need: FIVE_STAR.sessions, value: sessions, kind: 'sessions' })
    return blockers
  }
  const next = TIER_FLOORS.find((floor) => floor.tier === tier + 1)
  if (!next) return []
  const blockers = []
  for (const [key, min] of Object.entries(next.dims)) {
    const value = dims[key] ?? 0
    if (value + 1e-9 < min) blockers.push({ key, need: min, value, kind: 'dim' })
  }
  if (score + 1e-9 < next.score) blockers.push({ key: 'score', need: next.score, value: score, kind: 'score' })
  return blockers
}

/** 短板维度：取最低的那一维；全都很高时返回 undefined。 */
export function weakestOf(dims) {
  const entries = Object.entries(dims)
  entries.sort((a, b) => a[1] - b[1])
  const [key, value] = entries[0] ?? []
  return value === undefined || value >= 0.85 ? undefined : { key, name: DIM_NAMES[key], value }
}

const pct = (value) => `${Math.round(value * 100)}%`

/** 每维一句「现在怎样」和一句「怎么补」，供面板与工具输出用。 */
export function notesFor(dims, facts) {
  return {
    D1: {
      text: `资料基本上都在：${facts.onDisk}/${facts.n} 份能找到，${facts.inIndex}/${facts.n} 份列进了清单，${facts.described}/${facts.n} 份写了说明，${facts.titled}/${facts.n} 份有中文名，${facts.lnks}/${facts.n} 份有快捷方式`,
      fix: dims.D1 >= 0.9 ? '' : '把不在的补回来、给清单里没说明的补一句话、给缺的中文名和快捷方式补上',
    },
    D2: {
      text: `资料分布：一共 ${facts.materials} 份，分在 ${facts.topics} 个主题里，最大的主题占了 ${pct(facts.maxShare)}`,
      fix: dims.D2 >= 0.6 ? '' : `再补 ${Math.max(1, Math.ceil(4 - facts.effectiveTopics))} 个主题（每个 3 份以上），或者把最大的主题拆成几个小主题`,
    },
    D3: {
      text: `每份资料写得多细：${facts.longEnough} 份内容够厚，${facts.hasSource} 份写了出处，${facts.hasConclusion} 份有结论或结论段`,
      fix: dims.D3 >= 0.6 ? '' : '给偏薄的资料补一段「结论先说」，并写上出处链接',
    },
    D4: {
      text: `新旧程度：平均 ${facts.avgDays} 天前整理，${facts.stale} 份已经超过 ${facts.halfLife} 天没复查`,
      fix: dims.D4 >= 0.7 ? '' : `挑 ${facts.stale} 份过期的看一下，确认还能用就标上复核日期`,
    },
    D5: {
      text: `有没有人用过：${facts.sessions} 个会话用过，读过 ${pct(facts.readCoverage)} 的资料${facts.produced ? '，还留下过新产出' : '，但还没有读完之后的新产出'}`,
      fix: '这一项只影响第五颗星；在真实任务里用一次就会涨',
    },
    D6: {
      text: `还打算查什么：计划 ${facts.stepsTotal} 步，完成 ${facts.stepsDone} 步${facts.recRatio ? `，结论里有 ${pct(facts.recRatio)} 写了具体数字` : '，结论里还没写具体数字'}`,
      fix: dims.D6 >= 0.6 ? '' : '把计划里没做的步骤做掉，每条结论写一个数字或阈值',
    },
  }
}

function textOf(buffer) {
  return buffer.toString('utf8')
}

async function collectText(absPath) {
  let total = 0
  const chunks = []
  const stack = [absPath]
  while (stack.length && total < 400000) {
    const current = stack.pop()
    const info = await stat(current).catch(() => undefined)
    if (!info) continue
    if (info.isDirectory()) {
      const entries = await readdir(current, { withFileTypes: true }).catch(() => [])
      for (const entry of entries) stack.push(join(current, entry.name))
      continue
    }
    const ext = /\.[^.\\/]*$/.exec(current)?.[0]?.toLowerCase() ?? ''
    if (!TEXT_EXT.has(ext)) continue
    const buffer = await readFile(current).catch(() => undefined)
    if (!buffer) continue
    total += buffer.length
    if (chunks.reduce((sum, chunk) => sum + chunk.length, 0) < 400000) chunks.push(textOf(buffer))
  }
  return { bytes: total, text: chunks.join('\n') }
}

function ageOf(relPath, absPath, mtimeMs, now) {
  const match = /_(20\d{2})(\d{2})(\d{2})/.exec(relPath)
  if (match) {
    const when = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    if (!Number.isNaN(when.getTime())) return { days: Math.max(0, Math.floor((now - when) / 86400000)), from: '文件名' }
  }
  return { days: Math.max(0, Math.floor((now - mtimeMs) / 86400000)), from: '修改时间' }
}

function tsOf(entry) {
  const value = Date.parse(String(entry?.ts ?? ''))
  return Number.isNaN(value) ? 0 : value
}

function countSurvey(surveyText) {
  const steps = [...surveyText.matchAll(/^- \[( |x|X)\]\s*\d+\./gm)]
  const done = steps.filter((match) => match[1].toLowerCase() === 'x').length
  const stepRatio = steps.length ? done / steps.length : 0
  const rows = surveyText
    .split('\n')
    .filter((line) => line.startsWith('|'))
    .filter((line) => !/^\|\s*(步骤|---)/.test(line))
    .map((line) => line.replace(/\|/g, '').trim())
    .filter(Boolean)
  const withNumber = rows.filter((row) => /\d/.test(row)).length
  const recRatio = rows.length ? withNumber / rows.length : 0
  const goalSection = surveyText.split('## 目标').at(-1)?.split('##')[0] ?? ''
  const goal = (goalSection.match(/[\u4e00-\u9fa5]/g) ?? []).length > 15 ? 1 : 0
  return { stepRatio, recRatio, goal, done, total: steps.length }
}

/**
 * 给一个专家算成熟度。只读磁盘与 trace，不写文件。
 * @param {{library: any, expert: any, trace?: any[], now?: number}} input
 */
export async function expertMaturity({ library, expert, trace, now = Date.now() }) {
  const dir = expert.dir
  const topics = Array.isArray(expert.topics) ? expert.topics : []
  const declared = []
  for (const topic of topics) for (const rel of topic.files ?? []) declared.push({ topic: topic.id, rel })
  const files = declared.map((item) => item.rel)
  const n = files.length || 1

  const indexText = await readFile(join(dir, 'references', 'index.md'), 'utf8').catch(() => '')
  const indexRows = indexText.split('\n').filter((line) => line.startsWith('|') && line.includes('references/'))
  const indexFiles = new Set([...indexText.matchAll(/`(references\/[^`]+)`/g)].map((match) => match[1]))
  const mapText = await readFile(join(dir, '资料对照.md'), 'utf8').catch(() => '')
  const lnkDir = join(dir, '资料快捷方式')
  const lnks = (await readdir(lnkDir).catch(() => [])).filter((name) => name.endsWith('.lnk')).length
  const skillBuffer = await readFile(join(dir, 'SKILL.md')).catch(() => Buffer.alloc(0))

  // D1 结构完整度
  let onDisk = 0
  let inIndex = 0
  let described = 0
  let titled = 0
  for (const rel of files) {
    const abs = join(dir, rel)
    const info = await stat(abs).catch(() => undefined)
    if (info) onDisk += 1
    if (indexFiles.has(rel)) inIndex += 1
    if (expert.titles?.[rel] && mapText.includes(rel)) titled += 1
  }
  const weakRows = indexRows.filter((line) => WEAK_INDEX.some((weak) => line.includes(weak))).length
  described = Math.max(0, indexRows.length - weakRows)
  const D1 =
    0.3 * (onDisk / n) +
    0.25 * Math.min(1, inIndex / n) +
    0.25 * Math.min(1, described / n) +
    0.1 * (titled / n) +
    0.1 * Math.min(1, lnks / n)

  // D2 覆盖均衡
  const sizes = topics.map((topic) => (topic.files ?? []).length).filter(Boolean)
  const total = sizes.reduce((sum, size) => sum + size, 0) || 1
  const q = Math.min(1, Math.log(1 + total) / Math.log(41))
  const entropy = -sizes.reduce((sum, size) => sum + (size / total) * Math.log(size / total), 0)
  const effectiveTopics = Math.exp(entropy)
  const balance = Math.min(1, effectiveTopics / 4)
  const density = sizes.length ? Math.min(1, total / sizes.length / 4) : 0
  const D2 = 0.45 * q + 0.35 * balance + 0.2 * density

  // D3 内容可用度（代理）与 D4 新鲜度
  let longEnough = 0
  let hasSource = 0
  let hasConclusion = 0
  const ages = []
  const staleFiles = []
  for (const rel of files) {
    const abs = join(dir, rel)
    const info = await stat(abs).catch(() => undefined)
    if (!info) continue
    const { bytes, text } = await collectText(abs)
    if (bytes >= LARGE_ENOUGH) longEnough += 1
    if (/https?:\/\//.test(text)) hasSource += 1
    if (/结论|推荐|建议|取舍|判据|总结|一句话|TL;DR|速查/.test(text)) hasConclusion += 1
    const reviewed = expert.reviews?.[rel]?.reviewedAt
    const reviewedMs = reviewed ? Date.parse(reviewed) : Number.NaN
    const age = Number.isNaN(reviewedMs)
      ? ageOf(rel, abs, info.mtimeMs, now).days
      : Math.max(0, Math.floor((now - reviewedMs) / 86400000))
    ages.push(age)
    // 超过一年没复核的资料单独列出来，面板给一份「该复核」清单（只标不拦）。
    if (age > STALE_DAYS) staleFiles.push({ rel, days: age, reviewed: !Number.isNaN(reviewedMs) })
  }
  const D3 = 0.3 * (longEnough / n) + 0.35 * (hasSource / n) + 0.35 * (hasConclusion / n)
  const halfLife = HALF_LIFE[expert.id] ?? 180
  const freshness = ages.length ? ages.reduce((sum, days) => sum + 0.5 ** (days / halfLife), 0) / ages.length : 0
  const staleShare = ages.length ? ages.filter((days) => days > halfLife).length / ages.length : 0
  const D4 = freshness * (1 - 0.3 * staleShare)

  // D5 真实使用
  const events = (trace ?? []).filter((entry) => entry?.expert === expert.id)
  const skillBytes = skillBuffer.length || 1
  const sessions = new Map()
  const readPaths = new Set()
  let validLoads = 0
  let stubLoads = 0
  for (const entry of events) {
    const ageDays = Math.max(0, (now - tsOf(entry)) / 86400000)
    const w = 0.5 ** (ageDays / USE_HALF_LIFE)
    const session = entry.session || '__anon__'
    if (entry.kind === 'skill_load') {
      const chars = Number(entry.chars ?? skillBytes)
      if (chars >= 0.5 * skillBytes) {
        validLoads += 1
        sessions.set(session, Math.max(sessions.get(session) ?? 0, w))
      } else stubLoads += 1
    } else if (entry.kind === 'subagent') {
      sessions.set(session, Math.max(sessions.get(session) ?? 0, 0.5 * w))
    } else if (entry.kind === 'ref_read') {
      for (const rel of entry.paths ?? (entry.path ? [entry.path] : [])) readPaths.add(rel)
    }
  }
  const sessionScore = Math.min(1, [...sessions.values()].reduce((sum, w) => sum + w, 0) / 3)
  const readCoverage = Math.min(1, readPaths.size / n)
  let produced = 0
  for (const session of new Set(events.map((entry) => entry.session).filter(Boolean))) {
    const mine = events.filter((entry) => entry.session === session)
    const triggers = mine.filter(
      (entry) =>
        entry.kind === 'ref_read' ||
        (entry.kind === 'skill_load' && Number(entry.chars ?? 0) >= 0.5 * skillBytes),
    )
    for (const trigger of triggers) {
      const t0 = tsOf(trigger)
      const hit = mine.some(
        (entry) =>
          ['write', 'subagent', 'merge', 'ingest'].includes(entry.kind) &&
          tsOf(entry) >= t0 &&
          tsOf(entry) - t0 <= 6 * 3600 * 1000,
      )
      if (hit) {
        produced = 1
        break
      }
    }
    if (produced) break
  }
  const D5 = 0.5 * sessionScore + 0.25 * readCoverage + 0.25 * produced

  // D6 调研闭环
  const surveyText = await readFile(join(dir, 'survey.md'), 'utf8').catch(() => '')
  const survey = countSurvey(surveyText)
  const D6 = 0.5 * survey.stepRatio + 0.3 * survey.recRatio + 0.2 * survey.goal

  const dims = { D1, D2, D3, D4, D5, D6 }
  const round3 = (value) => Math.round(value * 1000) / 1000
  const contentScore = Math.round(100 * Object.entries(CONTENT_WEIGHTS).reduce((sum, [key, weight]) => sum + weight * dims[key], 0) * 10) / 10
  const usageScore = Math.round(100 * D5 * 10) / 10
  const score = Math.round((contentScore * (1 - USAGE_WEIGHT) + usageScore * USAGE_WEIGHT) * 10) / 10
  const contentTier = tierOf(score, dims)
  const level = levelOf(score, dims, { usageScore, sessions: sessions.size })
  const tier = level - 1
  const weakest = weakestOf(dims)
  const maxShare = total > 0 ? Math.max(...sizes, 0) / total : 0
  const notes = notesFor(dims, {
    n,
    onDisk,
    inIndex,
    described,
    titled,
    lnks,
    materials: files.length,
    topics: topics.length,
    maxShare,
    effectiveTopics,
    longEnough,
    hasSource,
    hasConclusion,
    avgDays: ages.length ? Math.round(ages.reduce((sum, days) => sum + days, 0) / ages.length) : 0,
    stale: ages.filter((days) => days > halfLife).length,
    halfLife,
    sessions: sessions.size,
    readCoverage,
    produced: Boolean(produced),
    stepsDone: survey.done,
    stepsTotal: survey.total,
    recRatio: survey.recRatio,
  })
  const queries = await scoreQueries(dir, expert.topics ?? [])
  const blockers = blockersFor(score, dims, contentTier, { usageScore, sessions: sessions.size })
  const nextTier = level < TIERS.length ? TIERS[level] : ''
  const blockerText = blockers.map((item) => {
    if (item.kind === 'score') return `分数还差 ${Math.round((item.need - item.value) * 10) / 10} 分`
    if (item.kind === 'usage') return `还没怎么被用过（使用分 ${Math.round(item.value)}，要 ${item.need}）`
    if (item.kind === 'sessions') return `用过的会话 ${item.value} 个，要 ${item.need} 个`
    return `${DIM_NAMES[item.key]}还差一点（现在 ${round3(item.value)}，要到 ${item.need}）`
  })
  return {
    score,
    contentScore,
    usageScore,
    tier: TIERS[level - 1],
    level,
    dims: Object.fromEntries(Object.entries(dims).map(([key, value]) => [key, round3(value)])),
    weakest: weakest?.key ?? '',
    hint: nextTier
      ? `资料分 ${contentScore}，使用分 ${usageScore}；想升到「${nextTier}」，还差：${blockerText.join('、') || '一点点分数'}`
      : `资料分 ${contentScore}，使用分 ${usageScore}；已经是最高的「标杆」`,
    notes,
    queries: queries ?? null,
    staleFiles: staleFiles.slice(0, 20),
    staleCount: staleFiles.length,
    blockers: blockerText,
    nextTier,
    materials: files.length,
    topics: topics.length,
    loads: { valid: validLoads, stub: stubLoads },
    sessions: sessions.size,
    steps: `${survey.done}/${survey.total}`,
  }
}

const cache = new Map()
const CACHE_MS = 60000

/** 带缓存的入口：同一专家一分钟内不重复扫盘。 */
export async function maturityOf(library, expert, trace) {
  const key = `${library.root}|${expert.id}`
  const now = Date.now()
  const hit = cache.get(key)
  if (hit && now - hit.at < CACHE_MS) {
    if (trace !== undefined) hit.pending = trace
    return hit.value
  }
  const value = await expertMaturity({ library, expert, trace, now })
  cache.set(key, { at: now, value })
  return value
}

/** 让测试能清缓存。 */
export function clearMaturityCache() {
  cache.clear()
}
