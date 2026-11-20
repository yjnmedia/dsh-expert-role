import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BUNDLED_EXPERTS } from '../lib/seed.js'

// 自带专家是用户看到的第一批内容：目录名、manifest、三表、登记必须自洽。
const ROOT = fileURLToPath(new URL('../bundled/experts', import.meta.url))

test('自带专家目录名就是它的 id', async () => {
  const dirs = (await readdir(ROOT, { withFileTypes: true })).filter((item) => item.isDirectory()).map((item) => item.name)
  assert.deepEqual(dirs.sort(), [...BUNDLED_EXPERTS].sort())
  for (const id of BUNDLED_EXPERTS) {
    const manifest = JSON.parse(await readFile(join(ROOT, id, 'manifest.json'), 'utf8'))
    assert.equal(manifest.id, id, `${id} 的 manifest.id 与目录名不一致`)
    assert.ok(manifest.title, `${id} 缺少 title`)
    assert.ok(Array.isArray(manifest.topics) && manifest.topics.length > 0, `${id} 缺少 topics`)
  }
})

test('每个自带专家都有 skill 说明与登记齐全的资料', async () => {
  for (const id of BUNDLED_EXPERTS) {
    const skill = await readFile(join(ROOT, id, 'SKILL.md'), 'utf8')
    assert.match(skill, new RegExp(`name:\\s*expert-${id}`), `${id} 的 SKILL.md 缺少 name: expert-${id}`)

    const manifest = JSON.parse(await readFile(join(ROOT, id, 'manifest.json'), 'utf8'))
    const index = await readFile(join(ROOT, id, 'references', 'index.md'), 'utf8')
    const titles = manifest.titles || {}
    assert.ok(Object.keys(titles).length > 0, `${id} 的 titles 为空`)
    for (const [rel, title] of Object.entries(titles)) {
      const file = rel.startsWith('references/') ? join(ROOT, id, rel) : join(ROOT, id, 'references', rel)
      const text = await readFile(file, 'utf8')
      assert.ok(text.length > 0, `${id}/${rel} 是空的`)
      const bare = rel.replace(/^references\//, '')
      assert.ok(index.includes(rel) || index.includes(bare), `${id}/references/index.md 没有登记 ${rel}`)
      assert.ok(title)
    }
    assert.ok((manifest.summaries && Object.keys(manifest.summaries).length) || (manifest.queries && manifest.queries.length), `${id} 没有 summaries 或 queries`)
  }
})
