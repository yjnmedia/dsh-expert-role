import { readFile, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * 检索自测：读 references/queries.md，按「问法」里的词能不能对上资料索引，
 * 算一个命中率。只读，不写文件，不进星级，只做徽章。
 * 格式：| 问法 | 应该命中 | 要点 | 上次自测 |
 */
const TABLE_ROW = /^\|/
const SEPARATOR = /^\|\s*-{2,}/

function cellsOf(line) {
  return line
    .replace(/^\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

function tokensOf(text) {
  const out = new Set()
  const source = String(text).toLowerCase()
  // 英文/数字按词切；中文按相邻两字切，避免整句变成一个词。
  for (const word of source.match(/[a-z0-9]{2,}/g) ?? []) out.add(word)
  for (const run of source.match(/[\u4e00-\u9fa5]+/g) ?? []) {
    if (run.length === 1) continue
    for (let i = 0; i + 2 <= run.length; i += 1) out.add(run.slice(i, i + 2))
  }
  return out
}

function overlap(a, b) {
  let hit = 0
  for (const token of a) if (b.has(token)) hit += 1
  return hit
}

/**
 * 带权重的重合度：太常见的词（几乎每份资料正文里都有「目录」「模型」）权重低，
 * 只在这份资料里出现的词权重高。否则通用词会把真正的资料挤下去。
 */
function weightedOverlap(query, entry, df, total) {
  let score = 0
  for (const token of query) {
    if (!entry.has(token)) continue
    const freq = df.get(token) ?? 1
    score += 1 + Math.log((total + 1) / (freq + 1))
  }
  return score
}

export async function parseQueries(dir) {
  const text = await readFile(join(dir, 'references', 'queries.md'), 'utf8').catch(() => '')
  if (!text) return []
  const rows = []
  for (const line of text.split(/\r?\n/)) {
    if (!TABLE_ROW.test(line) || SEPARATOR.test(line)) continue
    const cells = cellsOf(line)
    if (cells.length < 2) continue
    const head = `${cells[0]} ${cells[1] ?? ''}`
    // 表头与分隔行不算一条：中文表头写「问法 / 该看哪份」，英文写 question / expect。
    if (/问法|怎么问|该看哪|question|expect/i.test(head)) continue
    rows.push({
      question: cells[0],
      expect: String(cells[1] ?? '').replace(/`/g, '').trim(),
      keyPoints: cells[2] ?? '',
      last: cells[3] ?? '',
      // 第 5 列可写多个别名（用 | 或、或/分隔），匹配时一并把别名算进问法词袋
      aliases: cells.slice(4).filter(Boolean).join(' ').trim(),
    })
  }
  return rows
}

/** 读索引里的资料名与一句话，作为「库里的答案」。 */
export async function indexEntries(dir) {
  const text = await readFile(join(dir, 'references', 'index.md'), 'utf8').catch(() => '')
  const entries = []
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/`(references\/[^`]+)`/)
    if (!match) continue
    const cells = cellsOf(line)
    const name = cells[0] ?? ''
    const desc = cells[cells.length - 1] ?? ''
    entries.push({ rel: match[1], name, desc, tokens: tokensOf(`${match[1]} ${name} ${desc}`), bodyTokens: new Set(), body: '' })
  }
  return entries
}

async function readMaterial(dir, rel) {
  const abs = join(dir, rel)
  const info = await stat(abs).catch(() => undefined)
  if (!info) return ''
  if (info.isDirectory()) {
    for (const name of ['README.md', '调研报告.md', 'index.md']) {
      const text = await readFile(join(abs, name), 'utf8').catch(() => '')
      if (text) return text.slice(0, 4000)
    }
    // 目录里没有约定名字的文件时，取第一个 md 当正文（迁移过来的资料多是 S1/S2/S3 这种分节文件）。
    const entries = await readdir(abs, { withFileTypes: true }).catch(() => [])
    const first = entries.find((entry) => entry.isFile() && /\.md$/i.test(entry.name))
    if (first) return (await readFile(join(abs, first.name), 'utf8').catch(() => '')).slice(0, 4000)
    return ''
  }
  return (await readFile(abs, 'utf8').catch(() => '')).slice(0, 4000)
}

/**
 * 「命中了」不等于「答得上」：只提到关键词、没有可执行结论的资料，算没答上。
 * 判据取其一即可：出现数字+单位/百分比、出现代码或路径、出现约束词。
 * 这是代理指标，宁可漏判，不轻易把有料的资料判死。
 */
const EVIDENCE = [
  /\d+(?:\.\d+)?\s*(?:%|ms|毫秒|秒|s\b|px|dp|pt|em|rem|倍|年|天|小时|分钟|份|条|字|个|档|步|次)/i,
  /`[^`\n]{2,}`/,
  /```/,
  /(?:必须|不要|上限|阈值|至少|最多|不得超过|不低于|不建议)/,
  // 有明确结论也算答得上：这类资料是经验/取舍，不写数字但能直接照做。
  /(?:结论|推荐|建议|取舍|判据|总结|一句话|速查|不要用|优先)/,
]

export function hasEvidence(body) {
  const text = String(body || '')
  return EVIDENCE.some((re) => re.test(text))
}

/**
 * 按主题覆盖算自测题：某个主题下一条自测题都没有 → 这个主题没被覆盖。
 * 覆盖不到的主题，等于这个库有一块没人验证过。
 */
export function coverageOf(rows, topics) {
  const list = Array.isArray(topics) ? topics : []
  if (list.length === 0) return { topics: 0, covered: [], missing: [] }
  const covered = new Set()
  for (const row of rows) {
    const expect = String(row.expect || '').replace(/^references\//i, '').toLowerCase()
    if (!expect) continue
    for (const topic of list) {
      const files = (topic.files || []).map((file) => String(file).replace(/\\/g, '/').toLowerCase())
      if (files.some((file) => file.includes(expect) || expect.includes(file.replace(/^references\//, '')))) covered.add(topic.id)
    }
  }
  const missing = list.filter((topic) => !covered.has(topic.id)).map((topic) => topic.title || topic.id)
  return { topics: list.length, covered: [...covered], missing }
}

export async function scoreQueries(dir, topics = []) {
  const rows = await parseQueries(dir)
  if (rows.length === 0) return undefined
  const entries = await indexEntries(dir)
  for (const entry of entries) {
    const body = await readMaterial(dir, entry.rel)
    entry.body = body
    for (const token of tokensOf(body)) entry.bodyTokens.add(token)
  }
  // 只在索引元信息里出现的词更能说明「这份资料讲什么」；正文里的词很多是通用词，权重压低。
  const df = new Map()
  for (const entry of entries) for (const token of entry.tokens) df.set(token, (df.get(token) ?? 0) + 1)
  const BODY_WEIGHT = 0.35
  const misses = []
  const unanswerable = []
  let hit = 0
  for (const row of rows) {
    // 问法 + 别名 + 要点一起当查询词：要点本来就是这个库自己的说法
    const queryTokens = tokensOf(row.question + ' ' + (row.aliases || '') + ' ' + (row.keyPoints || ''))
    const ranked = entries
      .map((entry) => ({
        entry,
        score:
          weightedOverlap(queryTokens, entry.tokens, df, entries.length) +
          BODY_WEIGHT * weightedOverlap(queryTokens, entry.bodyTokens, df, entries.length),
      }))
      .sort((a, b) => b.score - a.score)
    const expectKey = row.expect.trim().toLowerCase()
    let matched
    if (expectKey) {
      const rank = ranked.findIndex(({ entry }) => entry.rel.toLowerCase().includes(expectKey) || entry.name.toLowerCase().includes(expectKey))
      matched = rank >= 0 && rank < 3 ? ranked[rank].entry : undefined
    } else if (ranked[0] && ranked[0].score / Math.max(1, queryTokens.size) >= 0.12) {
      matched = ranked[0].entry
    }
    if (!matched) {
      misses.push(row.question)
      continue
    }
    if (hasEvidence(matched.body)) hit += 1
    else unanswerable.push(`${row.question}（命中了「${matched.name || matched.rel}」，但里面没有可执行的结论）`)
  }
  const total = rows.length
  const coverage = coverageOf(rows, topics)
  const parts = [`自测：${total} 个常见问题里，有 ${hit} 个能找到资料并且答得上`]
  if (coverage.topics > 0) {
    parts.push(`覆盖 ${coverage.topics - coverage.missing.length}/${coverage.topics} 个主题${coverage.missing.length ? `（缺：${coverage.missing.slice(0, 3).join('、')}）` : ''}`)
  }
  if (unanswerable.length > 0) parts.push(`${unanswerable.length} 个问题命中了资料但答不上`)
  return {
    total,
    hit,
    rate: Math.round((hit / total) * 100),
    misses: misses.slice(0, 3),
    unanswerable: unanswerable.slice(0, 3),
    coverage,
    text: parts.join('；'),
  }
}
