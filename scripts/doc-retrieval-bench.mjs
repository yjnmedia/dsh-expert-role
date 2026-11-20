// 资料级检索评测：不问「哪位专家」，直接在全库资料里找最相关的几份，
// 看期望专家的资料是否进入前 K。K 默认 3。
import fs from 'node:fs'
import { ExpertLibrary } from '../lib/library.js'
import { scoreLibrary, rankExperts } from '../lib/topics.js'

const root = process.env.DSH_EXPERT_ROOT || 'E:/000Dev/AIExperts'
const K = Number(process.env.K ?? 3)
const sets = (process.env.SETS || 'set,set2').split(',')
const lib = new ExpertLibrary(root)
const experts = await lib.listExperts()

function docsOf() {
  const docs = []
  for (const e of experts) {
    const files = Object.keys(e.titles || {})
    for (const rel of files) docs.push({ expert: e.id, rel, title: e.titles[rel] || rel })
  }
  return docs
}
const docs = docsOf()

function rank(text) {
  const kw = rankExperts(text, experts)
  const weights = new Map(kw && kw.ranked ? kw.ranked.map((x) => [x.id, x.score / (kw.score || 1)]) : [])
  return docs
    .map((d) => {
      const local = scoreLibrary(text, experts.find((e) => e.id === d.expert))
      const hitTitle = local && local.label && d.title && (text.includes(d.title) || d.title.includes(text))
      const s = 0.6 * (weights.get(d.expert) || 0) + 0.4 * (local ? local.score : 0) + (hitTitle ? 0.3 : 0)
      return { ...d, s }
    })
    .sort((a, b) => b.s - a.s)
}

for (const name of sets) {
  const p = `E:/000Dev/TuoZiWorkbench/.tmp/eval-holdout/${name}.json`
  if (!fs.existsSync(p)) continue
  const set = JSON.parse(fs.readFileSync(p, 'utf8'))
  let hit = 0
  const fails = []
  for (const item of set) {
    const top = rank(item.question).slice(0, K)
    if (top.some((d) => d.expert === item.expected)) hit += 1
    else fails.push(item.id)
  }
  console.log(`${name}: 前 ${K} 命中 ${hit}/${set.length}（${((hit / set.length) * 100).toFixed(0)}%）`)
  if (process.env.FAILURES === '1') console.log('  未命中', fails.join(','))
}
