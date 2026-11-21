/**
 * 缺口主题归并（用户 2026-11-18 定）：
 * 「13 次没查到」不等于 13 件事——同一主题往往被问三五次。
 * 做法：按共同关键词把问法聚成主题，一条主题给一个可处理的单位。
 */

const STOPWORDS = new Set(['内容','操作','位置','使用','需要','支持','功能','方式','情况','问题','效果','时候','进行','出现','可以','如何','怎么','一个','这个','那个','哪些','什么'])
const STOP = new Set([
  '怎么', '如何', '什么', '为什么', '一下', '这个', '那个', '我们', '你们', '他们',
  '可以', '是否', '需要', '现在', '就是', '还是', '以及', '一个', '两个', '的话',
  '的', '了', '和', '与', '在', '是', '要', '我', '他', '她', '它',
])

/** 中文取相邻两字、英文取 3 个字符以上，去掉停用词。 */
export function tokenize(text) {
  const out = new Set()
  const raw = String(text ?? '').toLowerCase()
  for (const piece of raw.match(/[\u4e00-\u9fff]{2,}|[a-z][a-z0-9_]{2,}/g) ?? []) {
    if (/^[\u4e00-\u9fff]+$/.test(piece)) {
      for (let i = 0; i < piece.length - 1; i += 1) out.add(piece.slice(i, i + 2))
    } else {
      out.add(piece)
    }
  }
  for (const word of STOP) out.delete(word)
  for (const word of STOPWORDS) out.delete(word)
  return out
}

/**
 * 两个词袋是否同一主题。
 * 只数共享词会「串成一串」（商品列表→列表页→控件→同行控件），所以要求：
 * 共享 ≥2 个词，且占较短一方词袋的一半以上。
 */
export function sameTopic(a, b) {
  let shared = 0
  for (const word of a) if (b.has(word)) shared += 1
  if (shared < 2) return false
  const smaller = Math.min(a.size, b.size)
  return smaller > 0 && shared / smaller >= 0.5
}

/**
 * 把一串问法聚成主题。
 * @returns {{key:string,title:string,count:number,queries:string[],lastTs:string}}
 */
export function clusterQueries(items) {
  const groups = []
  for (const item of items ?? []) {
    const query = String(item?.query ?? '').trim()
    if (!query) continue
    const tokens = tokenize(query)
    const ts = String(item?.ts ?? '')
    let hit = null
    for (const group of groups) {
      // 只和这一组的首条问法比，避免一条条串成一大团。
      if (sameTopic(group.seed, tokens)) { hit = group; break }
    }
    if (!hit) {
      groups.push({ key: query.slice(0, 120), title: query.slice(0, 40), seed: tokens, count: 0, queries: [], times: [], lastTs: ts })
      hit = groups[groups.length - 1]
    }
    hit.count += 1
    hit.queries.push(query)
    if (ts) hit.times.push(ts)
    if (ts && ts > hit.lastTs) hit.lastTs = ts
  }
  return groups.map((group) => ({
    key: group.key,
    title: group.title,
    count: group.count,
    queries: group.queries,
    times: group.times,
    lastTs: group.lastTs,
  }))
}

/** 某位专家的缺口主题，按次数从多到少。 */
export function topicsOf(trace, expertId, options = {}) {
  const items = (trace ?? [])
    .filter((entry) => entry && entry.kind === 'miss' && entry.expert === expertId && entry.query)
    .map((entry) => ({ query: entry.query, ts: entry.ts }))
  const sinceIso = typeof options.sinceIso === 'string' ? options.sinceIso : ''
  const topics = clusterQueries(items)
  // 「补后」口径：只数最后一次补资料之后又被问住的次数。历史次数照旧保留在 count 里。
  for (const topic of topics) {
    topic.since = sinceIso ? (topic.times ?? []).filter((ts) => ts > sinceIso).length : topic.count
    topic.resolved = Boolean(sinceIso) && topic.since === 0 && topic.count > 0
  }
  return topics.sort((a, b) => {
    if (a.resolved !== b.resolved) return a.resolved ? 1 : -1
    return b.count - a.count
  })
}

/**
 * 自动判定一个缺口主题该怎么处理，不再让人点按钮：
 * - 别的专家明显更对口 → handoff（转给那位）
 * - 本专家已有相近主题/资料 → recover（整理已有产出）
 * - 都没有 → research（要花额度去查，才需要授权）
 */
export function autoDecideFor(topic, expert, rows, hit, libraryMatch) {
  const better = hit && hit.expertId && hit.expertId !== expert.id ? hit : null
  if (better) {
    return { action: 'handoff', to: better.expertId, why: '另一个专家更对口' }
  }
  if (libraryMatch) {
    return { action: 'recover', why: `已有资料「${libraryMatch}」` }
  }
  const titleTokens = tokenize(topic.title ?? topic.key ?? '')
  const ownTopics = (expert.topics ?? []).map((t) => ({ title: t.title ?? '', tokens: tokenize(t.title ?? '') }))
  for (const item of ownTopics) {
    let shared = 0
    for (const word of item.tokens) if (titleTokens.has(word)) shared += 1
    if (shared >= 2) return { action: 'recover', why: `已有主题「${item.title}」` }
  }
  return { action: 'research', why: '库里没有相近内容' }
}


/**
 * 在「这位专家已有的资料」里找与主题相近的条目。
 * 之前只比 topics[].title，会漏掉 references 里已经写好的资料
 * （例：同行控件高度不一致、表格可读性都已入库，却仍被判成「要去查」）。
 */
export function scoreLibrary(text, expert) {
  const bag = tokenize(text)
  if (!bag.size) return null
  const pool = []
  for (const item of expert?.topics || []) {
    if (!item?.title) continue
    const tokens = tokenize(item.title)
    pool.push({ label: item.title, title: tokens, extra: new Set() })
  }
  const titles = expert?.titles || {}
  const summaries = expert?.summaries || {}
  const queries = expert?.queries || {}
  const rels = new Set([...Object.keys(titles), ...Object.keys(queries)])
  for (const rel of rels) {
    const label = String(titles[rel] || rel)
    const extra = [summaries[rel] || '', rel, ...(Array.isArray(queries[rel]) ? queries[rel] : [])].join(' ')
    pool.push({ label, title: tokenize(label), extra: tokenize(extra) })
  }
  let best = null
  for (const item of pool) {
    let inTitle = 0
    let inExtra = 0
    for (const word of bag) {
      if (item.title.has(word)) inTitle += 1
      else if (item.extra.has(word)) inExtra += 1
    }
    const total = inTitle + inExtra
    if (total < 2) continue
    const ratio = total / bag.size
    const score = inTitle * 2 + inExtra + ratio
    if (!best || score > best.score) best = { label: item.label, inTitle, inExtra, total, ratio, score }
  }
  if (!best) return null
  // 名称比对权重更高：只靠「一句话」命中时要求更多共享词，避免把无关主题判成做过。
  if (best.inTitle >= 2) return best
  if (best.inTitle >= 1 && best.total >= 3 && best.ratio >= 0.2) return best
  if (best.inTitle === 0 && best.total >= 4 && best.ratio >= 0.3) return best
  return null
}

/** 只要标签（判定「库里有没有」时用）。 */
export function matchLibrary(text, expert) {
  const hit = scoreLibrary(text, expert)
  return hit ? hit.label : null
}

/**
 * 在多位专家之间做路由：谁最该接这个问题。
 *
 * 和 scoreLibrary 的区别：这里算「词在多库里有多常见」，越常见的词权重越低
 * （「面板」「情况」到处都有，不该拿来定归属）；同时把专家级的触发词
 * （manifest.triggerWords / 标题 / 简介）也算进来，避免只有主题名、没有同义说法时漏判。
 */
export function rankExperts(text, experts) {
  const bag = [...tokenize(text)]
  if (bag.length === 0) return null
  const profiles = (experts || []).map((expert) => {
    const strong = new Set()
    const weak = new Set()
    const addStrong = (value) => { for (const word of tokenize(value ?? '')) strong.add(word) }
    const addWeak = (value) => { for (const word of tokenize(value ?? '')) weak.add(word) }
    addStrong(expert.title)
    for (const item of expert.topics || []) addStrong(item.title)
    for (const rel of Object.keys(expert.titles || {})) addStrong(expert.titles[rel])
    for (const rel of Object.keys(expert.queries || {})) {
      for (const q of expert.queries[rel] || []) addStrong(q)
    }
    for (const rel of Object.keys(expert.summaries || {})) addWeak(expert.summaries[rel])
    for (const word of expert.triggerWords || []) addWeak(word)
    addWeak(expert.description)
    return { id: expert.id, strong, weak }
  })
  const df = new Map()
  for (const profile of profiles) {
    const all = new Set([...profile.strong, ...profile.weak])
    for (const word of all) df.set(word, (df.get(word) ?? 0) + 1)
  }
  const idf = (word) => 1 / Math.log(2 + (df.get(word) ?? profiles.length))
  const scored = profiles.map((profile) => {
    let score = 0
    for (const word of bag) {
      if (profile.strong.has(word)) score += 2 * idf(word)
      else if (profile.weak.has(word)) score += idf(word)
    }
    return { id: profile.id, score }
  }).sort((a, b) => b.score - a.score)
  const top = scored[0]
  if (!top || top.score <= 0) return null
  return {
    expertId: top.id,
    score: top.score,
    runnerUp: scored[1]?.id ?? null,
    margin: top.score - (scored[1]?.score ?? 0),
    ranked: scored.slice(0, 3),
  }
}
