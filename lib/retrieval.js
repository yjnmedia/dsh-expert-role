// 资料级检索：先按大类收窄候选（软过滤，允许并列），再在候选里按特征坐标精排。
// 大类判断错了也能靠「并列多个大类」兜住；仍不中时可关掉过滤退回全库。
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { createEmbedder, modelPaths, cosine } from './embed.js'

const CACHE_VERSION = 2
const BODY_CHARS = 1200

function bodyOf(abs) {
  try {
    const st = fs.statSync(abs)
    if (st.isFile()) return fs.readFileSync(abs, 'utf8').slice(0, BODY_CHARS)
    for (const name of ['README.md', 'index.md']) {
      const p = path.join(abs, name)
      if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').slice(0, BODY_CHARS)
    }
  } catch {}
  return ''
}

export function docsOf(library, experts) {
  const out = []
  for (const e of experts) {
    const titles = e.titles || {}
    const sums = e.summaries || {}
    for (const rawRel of Object.keys(titles)) {
      let rel = rawRel
      let abs = path.join(library.expertDir(e.id), rawRel)
      // 目录式资料（整份搬进来的文件夹）指向里面的 README.md，
      // 否则工具返回的路径打不开。
      try {
        const st = fs.statSync(abs)
        if (st.isDirectory()) {
          const readme = path.join(abs, 'README.md')
          if (fs.existsSync(readme)) {
            abs = readme
            rel = `${rawRel.replace(/\\/g, '/')}/README.md`
          }
        }
      } catch {
        /* 路径读不到就按原样登记，检索阶段仍会用到标题与摘要 */
      }
      out.push({
        expert: e.id,
        level1: e.level1 || '',
        level2: e.level2 || '',
        rel,
        title: titles[rawRel] || rel,
        summary: sums[rawRel] || '',
        text: `${titles[rawRel] || rel}。${sums[rawRel] || ''}。${bodyOf(abs)}`,
      })
    }
  }
  return out
}

function fingerprint(docs) {
  const h = crypto.createHash('sha256')
  for (const d of docs) h.update(`${d.expert}|${d.rel}|${d.text.length}|`)
  return `${CACHE_VERSION}:${h.digest('hex').slice(0, 16)}`
}

// 判别「该不该硬选」：最高分太低，或前两名几乎同分。
// 这两种情况下不要假装确定——并列列出，或直接说「可能没有」。
export function confidenceOf(ranked, { low = 0.5, gap = 0.01 } = {}) {
  const first = ranked?.[0]
  const second = ranked?.[1]
  if (!first) return { lowConfidence: true, close: false, top1: 0, top2: null }
  return {
    lowConfidence: first.score < low,
    close: Boolean(second) && first.score - second.score < gap,
    top1: first.score,
    top2: second ? second.score : null,
  }
}

// 没有本地模型时的兜底：字符二元组重合度（中文不分词），分数落在 0–1。
function bigrams(text) {
  const t = String(text || '').replace(/[\s\p{P}\p{S}]/gu, '')
  const out = new Set()
  for (let i = 0; i < t.length - 1; i += 1) out.add(t.slice(i, i + 2))
  return out
}

function lexicalScore(question, text) {
  const a = bigrams(question)
  const b = bigrams(text)
  if (!a.size || !b.size) return 0
  let hit = 0
  for (const g of a) if (b.has(g)) hit += 1
  return hit / a.size
}

export async function createRetriever({ library, experts, cachePath, baseDir }) {
  const docs = docsOf(library, experts)
  let embedder = null
  try {
    embedder = await createEmbedder(modelPaths(baseDir || undefined))
  } catch {
    embedder = null // 模型缺失：退化成关键词检索，不影响工具可用
  }
  const fp = fingerprint(docs)
  let vecs = null
  if (cachePath && fs.existsSync(cachePath)) {
    try {
      const c = JSON.parse(fs.readFileSync(cachePath, 'utf8'))
      if (c.fp === fp && Array.isArray(c.vectors) && c.vectors.length === docs.length) {
        vecs = c.vectors.map((v) => Float32Array.from(v))
      }
    } catch {}
  }
  if (embedder && !vecs) {
    vecs = await embedder.embed(docs.map((d) => d.text))
    if (cachePath) {
      try {
        fs.mkdirSync(path.dirname(cachePath), { recursive: true })
        fs.writeFileSync(cachePath, JSON.stringify({ fp, vectors: vecs.map((v) => Array.from(v)) }))
      } catch {}
    }
  }
  const groupOf = (i) => docs[i].level1 || '未分组'

  // 软过滤：先算各大类最高分，保留与最高分相差 < margin 的大类（至少 2 个、至多 3 个）。
  function pickGroups(scores, margin) {
    const best = new Map()
    scores.forEach((s, i) => {
      const g = groupOf(i)
      if (!best.has(g) || s > best.get(g).s) best.set(g, { s, i })
    })
    const ranked = [...best.entries()].sort((a, b) => b[1].s - a[1].s)
    const top = ranked[0]?.[1].s ?? 0
    const keep = ranked.filter(([, v], idx) => idx < 2 || v.s >= top - margin).slice(0, 3).map(([g]) => g)
    return { keep, ranked: ranked.map(([g, v]) => ({ group: g, score: v.s })) }
  }

  async function retrieve(question, { k = 3, margin = 0.05, useGroups = true } = {}) {
    let scores
    if (embedder && vecs) {
      const [q] = await embedder.embed([question])
      scores = vecs.map((v) => cosine(q, v))
    } else {
      scores = docs.map((d) => lexicalScore(question, d.text))
    }
    const groups = pickGroups(scores, margin)
    const allowed = useGroups ? new Set(groups.keep) : null
    const ranked = docs
      .map((d, i) => ({ ...d, score: scores[i] }))
      .filter((d) => !allowed || allowed.has(d.level1 || '未分组'))
      .sort((a, b) => b.score - a.score)
    return { top: ranked.slice(0, k), all: ranked, groups, mode: embedder && vecs ? 'vector' : 'lexical', ...confidenceOf(ranked) }
  }

  return {
    retrieve,
    docs,
    mode: embedder ? 'vector' : 'lexical',
    groups: [...new Set(docs.map((d) => d.level1 || '未分组'))],
  }
}
