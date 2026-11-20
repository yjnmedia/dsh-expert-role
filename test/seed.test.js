import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ExpertLibrary } from '../lib/library.js'
import { seedBundledExperts, BUNDLED_EXPERTS } from '../lib/seed.js'

async function makeBundle(root, ids) {
  for (const id of ids) {
    await mkdir(join(root, id, 'references'), { recursive: true })
    await writeFile(join(root, id, 'SKILL.md'), `---\nname: expert-${id}\ndescription: 测试用\n---\n\n正文\n`, 'utf8')
    await writeFile(join(root, id, 'manifest.json'), JSON.stringify({ id, title: '测试' }), 'utf8')
    await writeFile(join(root, id, 'references', 'index.md'), '# 索引\n', 'utf8')
  }
}

test('自带专家首次启动复制进库，第二次不再动用户文件', async () => {
  const base = await mkdtemp(join(tmpdir(), 'seed-expert-'))
  const bundledRoot = join(base, 'bundled')
  const root = join(base, 'lib')
  await makeBundle(bundledRoot, ['guide', 'dsh-plugin'])
  const library = new ExpertLibrary(root)

  const first = await seedBundledExperts(library, { bundledRoot })
  assert.deepEqual(first.sort(), ['dsh-plugin', 'guide'])
  assert.ok((await readdir(root)).includes('guide'))

  // 用户改过的内容不能被覆盖
  const skill = join(root, 'guide', 'SKILL.md')
  await writeFile(skill, '用户自己改的\n', 'utf8')
  const second = await seedBundledExperts(library, { bundledRoot })
  assert.deepEqual(second, [])
  assert.equal(await readFile(skill, 'utf8'), '用户自己改的\n')

  await rm(base, { recursive: true, force: true })
})

test('包内没有 bundled 目录时安静跳过', async () => {
  const base = await mkdtemp(join(tmpdir(), 'seed-none-'))
  const library = new ExpertLibrary(join(base, 'lib'))
  const seeded = await seedBundledExperts(library, { bundledRoot: join(base, 'missing') })
  assert.deepEqual(seeded, [])
  await rm(base, { recursive: true, force: true })
})

test('自带清单只含设计专家与插件专家', () => {
  assert.deepEqual([...BUNDLED_EXPERTS].sort(), ['dsh-plugin', 'guide'])
})
