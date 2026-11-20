// 混合路由评测：语义（bge-small-zh）+ 关键词（rankExperts），按 w 加权。
import fs from 'node:fs'
import { ExpertLibrary } from '../lib/library.js'
import { createEmbedder, modelPaths } from '../lib/embed.js'
import { createSemanticRouter } from '../lib/routing.js'
import { rankExperts } from '../lib/topics.js'

const root = process.env.DSH_EXPERT_ROOT || 'E:/000Dev/AIExperts'
const setPath = process.env.EVAL_SET || 'E:/000Dev/TuoZiWorkbench/.tmp/eval-holdout/set2.json'
const w = Number(process.env.W ?? 0.75)
const lib = new ExpertLibrary(root)
const experts = await lib.listExperts()
const emb = await createEmbedder(modelPaths(process.cwd()))
const sem = await createSemanticRouter({ library: lib, embedder: emb, abstainMargin: 0 })
const set = JSON.parse(fs.readFileSync(setPath, 'utf8'))

let hit = 0
const fails = []
for (const item of set) {
  const s = await sem.route(item.question)
  const semMap = new Map(s.ranked.map((x) => [x.id, x.score]))
  const kw = rankExperts(item.question, experts)
  const kwMax = (kw && kw.score) || 1
  const kwMap = new Map(kw && kw.ranked ? kw.ranked.map((x) => [x.id, x.score / kwMax]) : [])
  let best = null
  for (const e of experts) {
    const v = w * (semMap.get(e.id) || 0) + (1 - w) * (kwMap.get(e.id) || 0)
    if (!best || v > best.v) best = { id: e.id, v }
  }
  if (best.id === item.expected) hit += 1
  else fails.push({ id: item.id, expected: item.expected, got: best.id })
}
console.log(`题库 ${set.length} 条，w=${w}：命中 ${hit}（${((hit / set.length) * 100).toFixed(0)}%）`)
if (process.env.FAILURES === '1') for (const f of fails) console.log(`✗ #${f.id} 期望 ${f.expected} 实得 ${f.got}`)
