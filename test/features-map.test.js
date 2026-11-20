import { readFileSync } from 'node:fs'
// 功能地图的确定性检查：
//   1) 面板里每个页签（client.js 里 setTab('<key>')）都要在 docs/features/tab-<key>.md 有卡；
//   2) 每张工具卡（docs/features/tool-*.md）标题里点到的工具名，必须真的在 lib/tools.js 注册；
//   3) 每张卡都必须有「能干什么 / 怎么到 / 怎么验 / 已知坑」四段。
// 目的：加了页签或工具却没人写它怎么验，这件事在测试阶段就炸出来，而不是等到别人猜。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.join(here, '..')
const FEATURES = path.join(repo, 'docs', 'features')
const CLIENT = path.join(repo, 'lib', 'client.js')
const TOOLS = path.join(repo, 'lib', 'tools.js')

const SECTIONS = ['能干什么', '怎么到', '怎么验', '已知坑']

test('面板每个页签都有功能卡', () => {
  const src = fs.readFileSync(CLIENT, 'utf8')
  const keys = [...new Set([...src.matchAll(/setTab\('([a-zA-Z]+)'\)/g)].map((m) => m[1]))]
  assert.ok(keys.length >= 5, '没从 client.js 里解析出页签，正则可能失效了')
  const missing = keys.filter((key) => !fs.existsSync(path.join(FEATURES, `tab-${key}.md`)))
  assert.deepEqual(missing, [], '这些页签没有功能卡：' + missing.map((k) => `docs/features/tab-${k}.md`).join('、'))
})

test('工具卡点到的工具名都真实存在', () => {
  const toolsSrc = fs.readFileSync(TOOLS, 'utf8')
  const registered = new Set([...toolsSrc.matchAll(/name: '(expert_[a-z_]+|lookup_expert_knowledge)'/g)].map((m) => m[1]))
  const cards = fs.readdirSync(FEATURES).filter((f) => f.startsWith('tool-') && f.endsWith('.md'))
  const unknown = []
  for (const card of cards) {
    const text = fs.readFileSync(path.join(FEATURES, card), 'utf8')
    const names = [...new Set([...text.matchAll(/\b(expert_[a-z_]+|lookup_expert_knowledge)\b/g)].map((m) => m[1]))]
    if (names.length === 0) unknown.push(card + '：卡里没写工具名')
    for (const name of names) if (!registered.has(name)) unknown.push(card + '：工具名没注册 ' + name)
  }
  assert.deepEqual(unknown, [])
})

test('每张功能卡都有四段', () => {
  const bad = []
  for (const file of fs.readdirSync(FEATURES).filter((f) => f.endsWith('.md') && f !== 'README.md')) {
    const text = fs.readFileSync(path.join(FEATURES, file), 'utf8')
    for (const section of SECTIONS) if (!text.includes(section)) bad.push(file + '：缺「' + section + '」')
  }
  assert.deepEqual(bad, [])
})

test('会话提示词里写清了三段式与标记', () => {
  const file = path.join(repo, 'docs', 'session-prompts.md')
  const text = fs.readFileSync(file, 'utf8')
  for (const word of ['结论：', '证据：', '待办：', '【要你看·花额度】', '【不用你看】']) {
    if (!text.includes(word)) throw new Error('docs/session-prompts.md 缺「' + word + '」：三段式或标记被删了')
  }
})

test('提示词文档锁住三条硬规则：三段、标记、机器读的部分 ASCII', async () => {
  const text = readFileSync(fileURLToPath(new URL('../docs/session-prompts.md', import.meta.url)), 'utf8')
  for (const need of ['结论：', '证据：', '待办：', '【要你看·花额度】', '【不用你看】']) {
    assert.ok(text.includes(need), '提示词缺少「' + need + '」')
  }
  assert.ok(text.includes('机器读的部分写成 ASCII'), '缺少 ASCII 参数规矩')
  assert.ok(text.includes('不要用中文做文件名'), '缺少文件名规矩')
  assert.ok(text.includes('不要加'), '缺少「不要加额外格式」的禁止项')
  assert.ok(!text.includes('experts-demo'), '提示词里不该写死演示路径，应使用占位')
})
