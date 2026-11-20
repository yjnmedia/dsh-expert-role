// 语义路由评测：读题库 JSON（[{question, expected}]），打印准确率/覆盖率。
import fs from 'node:fs'
import { ExpertLibrary } from '../lib/library.js'
import { createEmbedder, modelPaths } from '../lib/embed.js'
import { createSemanticRouter } from '../lib/routing.js'

const root = process.env.DSH_EXPERT_ROOT || 'E:/000Dev/AIExperts'
const setPath = process.env.EVAL_SET || 'E:/000Dev/TuoZiWorkbench/.tmp/eval-holdout/set.json'
const margin = Number(process.env.MARGIN ?? 0.02)
const lib = new ExpertLibrary(root)
const embedder = await createEmbedder(modelPaths(process.cwd()))
const router = await createSemanticRouter({ library: lib, embedder, abstainMargin: margin })
const set = JSON.parse(fs.readFileSync(setPath, 'utf8'))

let hit = 0
let abstain = 0
const fails = []
for (const item of set) {
  const r = await router.route(item.question)
  if (r.expertId === null) abstain += 1
  else if (r.expertId === item.expected) hit += 1
  else fails.push({ id: item.id, expected: item.expected, got: r.expertId, score: r.score.toFixed(3), margin: r.margin.toFixed(3) })
}
const n = set.length
console.log(`题库 ${n} 条，margin=${margin}`)
console.log(`命中 ${hit}（${((hit / n) * 100).toFixed(0)}%），弃权 ${abstain}，答错 ${n - hit - abstain}`)
if (process.env.FAILURES === '1') for (const f of fails) console.log(`✗ #${f.id} 期望 ${f.expected} 实得 ${f.got}（${f.score}/margin ${f.margin}）`)
