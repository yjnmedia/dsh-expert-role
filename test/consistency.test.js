// 一致性检查（跑真实资料库，机器上没有库就跳过）：
//   1) 两级目录里，专家目录名必须等于 manifest.id；
//   2) SKILL.md 写死的「N 位专家 / M 个文件」必须和磁盘一致（数字是快照，库变了就得改这句话）；
//   3) SKILL.md 点到的 references/... 路径必须真实存在；
//   4) taxonomy 的八类必须和磁盘 01-…08- 大类目录一一对应；
//   5) 会话回话的【要你看·…】标记：合法标记认得对，乱写的标记不崩、照样算「要你看」。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ExpertLibrary } from '../lib/library.js'
import { judgeNeeds, judgeFields } from '../lib/session-log.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.join(here, '..')
const ROOT = process.env.DSH_EXPERT_ROOT || 'D:/experts-demo'
const hasLibrary = fs.existsSync(ROOT)
const skip = !hasLibrary && `找不到资料库 ${ROOT}`

async function openLib() {
  const lib = new ExpertLibrary(ROOT)
  const ids = await lib.listExpertIds()
  return { lib, ids }
}

test('专家目录名 == manifest.id', { skip }, async () => {
  const { lib, ids } = await openLib()
  const bad = []
  for (const id of ids) {
    const expert = await lib.readExpert(id)
    if (!expert) { bad.push(id + '：读不到 manifest.json'); continue }
    if (expert.id && expert.id !== id) bad.push(id + '：manifest.id=' + expert.id)
  }
  assert.deepEqual(bad, [])
})

test('SKILL.md 写死的数字与磁盘一致', { skip }, async () => {
  const { lib, ids } = await openLib()
  const totalExperts = ids.length
  const bad = []

  for (const id of ids) {
    const file = path.join(lib.expertDir(id), 'SKILL.md')
    if (!fs.existsSync(file)) { bad.push(id + '：没有 SKILL.md'); continue }
    const text = fs.readFileSync(file, 'utf8')

    for (const m of text.matchAll(/(\d+)\s*位专家/g)) {
      const claimed = Number(m[1])
      // 总入口说的是「库里一共几位」，其它专家只说自己的那一位。
      const expected = id === 'expert-library' ? totalExperts - 1 : 1
      if (claimed !== expected) bad.push(`${id}：写「${claimed} 位专家」，实际 ${expected}`)
    }
    // 文件数故意不查：一加资料就要改文档，谁也跟不上；只在文档里禁止写死，改成查 expert_status。
    if (id === 'expert-library' && /\d+\s*(?:份资料|个文件)/.test(text)) {
      bad.push(`${id}：SKILL.md 写死了文件数，改成「用 expert_status 查」`)
    }
  }
  assert.deepEqual(bad, [])
})

test('SKILL.md 点到的 references 路径真实存在', { skip }, async () => {
  const { lib, ids } = await openLib()
  const missing = []
  for (const id of ids) {
    const file = path.join(lib.expertDir(id), 'SKILL.md')
    if (!fs.existsSync(file)) continue
    const dir = lib.expertDir(id)
    for (const m of fs.readFileSync(file, 'utf8').matchAll(/(?:references|references\/)[^\s`'")）\]]+\.(?:md|json)/g)) {
      const rel = m[0].replace(/^\/+/, '')
      if (!fs.existsSync(path.join(dir, rel))) missing.push(id + '：' + rel)
    }
  }
  assert.deepEqual([...new Set(missing)], [])
})

test('taxonomy 八类与磁盘大类目录一一对应', { skip }, async () => {
  const taxo = JSON.parse(fs.readFileSync(path.join(repo, 'taxonomy.json'), 'utf8'))
  const titles = (taxo.categories || taxo.groups || []).map((c) => c.title || c.name).filter(Boolean)
  assert.equal(titles.length, 8)
  const dirs = fs.readdirSync(ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^\d{2}-/.test(e.name))
    .map((e) => e.name.replace(/^\d{2}-/, ''))
  assert.deepEqual(dirs.sort(), titles.slice().sort())
})

test('会话标记：合法的认得对，乱写的不崩且照样算要你看', () => {
  assert.equal(judgeNeeds('这轮没事。【不用你看】').need, false)
  assert.deepEqual(
    (() => { const j = judgeFields(judgeNeeds('补两份资料要花钱。【要你看·花额度】')); return { need: j.need, kind: j.needKind } })(),
    { need: true, kind: 'spend' },
  )
  const weird = judgeFields(judgeNeeds('【要你看·这个我瞎写的】随你怎么说'))
  assert.equal(weird.need, true, '乱写的标记也要算「要你看」，不能当成没事')
  assert.ok(weird.needKind, '乱写的标记也要给个归类，不能是空')
})
