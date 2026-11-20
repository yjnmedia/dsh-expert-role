import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { verifyResearch } from '../lib/research.js'

async function makeExpert() {
  const root = await mkdtemp(join(tmpdir(), 'expert-verify-'))
  const expertDir = join(root, '03-界面与体验', 'ui-design')
  const refs = join(expertDir, 'references')
  await mkdir(refs, { recursive: true })
  await writeFile(join(refs, 'index.md'), '# 索引\n\n| 老资料 | `references/old.md` | 之前就有 |\n')
  await writeFile(join(expertDir, 'manifest.json'), JSON.stringify({ titles: { 'references/old.md': '老资料' } }))
  return { root, expertDir, refs }
}

test('新写的资料没登记时：算 1 份、registered 为 false、指名哪一份', async () => {
  const { expertDir, refs } = await makeExpert()
  const startedAt = new Date(Date.now() - 60000).toISOString()
  await writeFile(join(refs, 'new-one.md'), '# 新资料\n')
  const result = await verifyResearch({ expertDir, startedAt })
  assert.equal(result.added, 1)
  assert.equal(result.registered, false)
  assert.equal(result.files[0].rel, 'new-one.md')
  assert.equal(result.files[0].inIndex, false)
  assert.equal(result.files[0].inManifest, false)
})

test('index 与 manifest 都登记后：registered 为 true', async () => {
  const { expertDir, refs } = await makeExpert()
  const startedAt = new Date(Date.now() - 60000).toISOString()
  await writeFile(join(refs, 'new-one.md'), '# 新资料\n')
  await writeFile(
    join(refs, 'index.md'),
    '# 索引\n\n| 老资料 | `references/old.md` | 之前就有 |\n| 新资料 | `references/new-one.md` | 这次补的 |\n',
  )
  await writeFile(
    join(expertDir, 'manifest.json'),
    JSON.stringify({ titles: { 'references/old.md': '老资料', 'references/new-one.md': '新资料' } }),
  )
  const result = await verifyResearch({ expertDir, startedAt })
  assert.equal(result.added, 1)
  assert.equal(result.registered, true)
})

test('跑之前就有的文件不算这次补的', async () => {
  const { expertDir } = await makeExpert()
  const startedAt = new Date(Date.now() + 5000).toISOString()
  const result = await verifyResearch({ expertDir, startedAt })
  assert.equal(result.added, 0)
  assert.equal(result.registered, false)
})

test('目录不存在时不抛错，返回零份', async () => {
  const result = await verifyResearch({ expertDir: join(tmpdir(), 'no-such-expert-dir-xyz'), startedAt: new Date().toISOString() })
  assert.equal(result.added, 0)
  assert.equal(result.registered, false)
})
