import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'

const BUNDLED = join(process.cwd(), 'bundled', 'experts')

async function dirs() {
  const entries = await readdir(BUNDLED, { withFileTypes: true })
  return entries.filter((e) => e.isDirectory()).map((e) => e.name)
}

test('自带专家：目录名、manifest.id、三表齐全', async () => {
  const ids = await dirs()
  assert.ok(ids.length >= 2, '至少要有两位自带专家')
  for (const id of ids) {
    const dir = join(BUNDLED, id)
    const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8'))
    assert.equal(manifest.id, id, `${id} 的 manifest.id 与目录名不一致`)
    assert.ok(manifest.title, `${id} 缺 title`)

    const skill = await readFile(join(dir, 'SKILL.md'), 'utf8')
    assert.match(skill, /^---\n[\s\S]*name:\s*expert-/, `${id} 的 SKILL.md 缺 frontmatter name`)

    const index = await readFile(join(dir, 'references', 'index.md'), 'utf8')
    const titles = Object.keys(manifest.titles ?? {})
    assert.ok(titles.length > 0, `${id} 的 titles 为空`)
    for (const rel of titles) {
      const full = join(dir, rel)
      await stat(full)
      const stem = rel.split('/').pop()
      assert.ok(index.includes(stem), `${id} 的 index.md 没登记 ${stem}`)
    }
    assert.ok(manifest.summaries && Object.keys(manifest.summaries).length > 0, `${id} 缺 summaries`)
    assert.ok(manifest.queries && Object.keys(manifest.queries).length > 0, `${id} 缺 queries`)
  }
})
