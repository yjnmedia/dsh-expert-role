// 资料级检索评测（带/不带大类软过滤各测一遍）
import fs from 'node:fs'
import { ExpertLibrary } from '../lib/library.js'
import { createRetriever } from '../lib/retrieval.js'

const root = process.env.DSH_EXPERT_ROOT || 'E:/000Dev/AIExperts'
const lib = new ExpertLibrary(root)
const experts = await lib.listExperts()
const r = await createRetriever({
  library: lib,
  experts,
  cachePath: process.env.CACHE || 'E:/000Dev/TuoZiWorkbench/.tmp/docindex.json',
})
console.log('资料', r.docs.length, '份；大类', r.groups.join(' / '))
for (const useGroups of [true, false]) {
  for (const name of ['set', 'set2']) {
    const p = `E:/000Dev/TuoZiWorkbench/.tmp/eval-holdout/${name}.json`
    if (!fs.existsSync(p)) continue
    const set = JSON.parse(fs.readFileSync(p, 'utf8'))
    let h1 = 0, h3 = 0
    for (const it of set) {
      const res = await r.retrieve(it.question, { k: 3, useGroups })
      if (res.top[0] && res.top[0].expert === it.expected) h1 += 1
      if (res.top.some((d) => d.expert === it.expected)) h3 += 1
    }
    console.log(`${useGroups ? '大过滤' : '全库  '} ${name}: top1 ${h1}/${set.length}  top3 ${h3}/${set.length}`)
  }
}
