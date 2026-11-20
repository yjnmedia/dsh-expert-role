import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))

function sectionOf(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker)
  assert.ok(start >= 0, '找不到起点：' + startMarker)
  const end = source.indexOf(endMarker, start)
  assert.ok(end > start, '找不到终点：' + endMarker)
  return source.slice(start, end)
}

test('调研只投进大类会话：startGapResearch 里不许建会话', () => {
  const source = readFileSync(join(root, 'lib', 'index.js'), 'utf8')
  const body = sectionOf(source, 'const startGapResearch', '// 列运行记录时顺手诊断')
  for (const banned of ['sessionController', 'controller.create', 'createAgent(', 'agents.create']) {
    assert.ok(!body.includes(banned), 'startGapResearch 里出现了建会话调用：' + banned)
  }
  assert.ok(body.includes('categorySessionId('), 'startGapResearch 应当按大类取固定会话号')
})

test('只有八个大类会话号，且没有缺口会话号的生成逻辑', () => {
  const source = readFileSync(join(root, 'lib', 'research.js'), 'utf8')
  assert.ok(source.includes('session-expert-cat-'), '应当有八个大类会话号')
  assert.ok(!/session-expert-gap-/.test(source), '不应再生成 session-expert-gap- 会话号')
})

test('八大类会话号的顺序与 taxonomy 一致', async () => {
  const { loadTaxonomy } = await import('../lib/taxonomy.js')
  const { categorySessionId } = await import('../lib/research.js')
  const taxonomy = await loadTaxonomy()
  assert.equal(taxonomy.groups.length, 8)
  taxonomy.groups.forEach((group, index) => {
    assert.equal(categorySessionId(index + 1), 'session-expert-cat-' + String(index + 1).padStart(2, '0'))
    assert.ok(group.title)
  })
})
