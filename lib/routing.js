// 语义路由：把每位专家写成一段「伪文档」，用本地向量比相似度；分差太小就弃权。
import { cosine } from './embed.js'

export function expertDoc(expert) {
  const parts = []
  parts.push(`专家：${expert.title || expert.id}`)
  if (expert.description) parts.push(expert.description)
  if (expert.whenToUse) parts.push(`什么时候用：${expert.whenToUse}`)
  const topics = (expert.topics || []).filter((t) => t && t.title)
  if (topics.length) {
    parts.push('覆盖：' + topics.map((t) => `${t.title}（${t.whenToUse || '相关问题时'}）`).join('；'))
  }
  const samples = []
  const queries = expert.queries || {}
  for (const rel of Object.keys(queries)) {
    for (const q of queries[rel] || []) samples.push(q)
    if (samples.length >= 8) break
  }
  if (samples.length) parts.push('典型问法：' + samples.slice(0, 8).join('；'))
  return parts.join('\n')
}

const QUERY_PREFIX = '为这个句子生成表示以用于检索相关文章：'

function blocksOf(expert) {
  const out = []
  const head = `${expert.title || expert.id}。${expert.description || ''}${expert.whenToUse ? '适用：' + expert.whenToUse : ''}`
  out.push(head)
  const queries = expert.queries || {}
  for (const topic of expert.topics || []) {
    const lines = [`${topic.title}${topic.whenToUse ? '：' + topic.whenToUse : ''}`]
    const files = topic.files || []
    for (const rel of files) {
      const qs = queries[rel]
      if (Array.isArray(qs)) lines.push(...qs.slice(0, 3))
    }
    out.push(lines.join('。'))
  }
  return out
}

export async function createSemanticRouter({ library, embedder, abstainMargin = 0.02 }) {
  const experts = await library.listExperts()
  const docs = []
  for (const e of experts) for (const text of blocksOf(e)) docs.push({ id: e.id, text })
  const vectors = await embedder.embed(docs.map((d) => d.text))

  async function route(question) {
    const [q] = await embedder.embed([QUERY_PREFIX + question])
    const best = new Map()
    docs.forEach((d, i) => {
      const s = cosine(q, vectors[i])
      if (!best.has(d.id) || s > best.get(d.id)) best.set(d.id, s)
    })
    const scored = [...best.entries()].map(([id, score]) => ({ id, score })).sort((a, b) => b.score - a.score)
    const top = scored[0]
    const second = scored[1] || { id: null, score: 0 }
    const margin = top.score - second.score
    if (margin < abstainMargin) {
      return { expertId: null, score: top.score, margin, top: top.id, ranked: scored.slice(0, 3) }
    }
    return { expertId: top.id, score: top.score, margin, runnerUp: second.id, ranked: scored.slice(0, 3) }
  }
  return { route, docs }
}
