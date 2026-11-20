// 独立验收：读 .tmp/eval-holdout/set.json，只打印命中数与分数。
// FAILURES=1 时才打印失败题（默认不打印，避免边看边调）。
import fs from 'node:fs'
import { ExpertLibrary } from '../lib/library.js'
import { rankExperts } from '../lib/topics.js'

const root = process.env.DSH_EXPERT_ROOT || 'E:/000Dev/AIExperts'
const setPath = process.env.EVAL_SET || 'E:/000Dev/TuoZiWorkbench/.tmp/eval-holdout/set.json'
const lib = new ExpertLibrary(root)
const experts = await lib.listExperts()
const set = JSON.parse(fs.readFileSync(setPath, 'utf8'))

let hit = 0
const fails = []
for (const item of set) {
  const ranked = rankExperts(item.question, experts)
  const top = ranked?.expertId ?? null
  if (top === item.expected) hit += 1
  else fails.push({ id: item.id, expected: item.expected, got: top, score: ranked?.score ?? 0 })
}
const pct = ((hit / set.length) * 100).toFixed(0)
console.log(`验收：${hit}/${set.length}（${pct}%）`)
if (process.env.FAILURES === '1') {
  for (const f of fails) console.log(`✗ #${f.id} 期望 ${f.expected} 实得 ${f.got}（${f.score}）`)
} else if (fails.length) {
  console.log(`未命中 ${fails.length} 条（设置 FAILURES=1 可看到明细）`)
}
