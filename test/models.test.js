import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { hasModel, resolveModelDir, libraryModelDir, legacyModelDir } from '../lib/models.js'

async function fakeModels(dir) {
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'model-fp32.onnx'), Buffer.alloc(2 * 1024 * 1024))
  await writeFile(join(dir, 'vocab.txt'), 'x'.repeat(2048))
}

test('模型目录优先用库根，插件内旧目录只作兜底', async (t) => {
  const base = await mkdtemp(join(tmpdir(), 'expert-models-'))
  t.after(() => rm(base, { recursive: true, force: true }))
  const root = join(base, 'lib')
  const pluginDir = join(base, 'plugin')

  assert.equal(hasModel(libraryModelDir(root)), false)
  assert.deepEqual(resolveModelDir({ root, pluginDir }).source, 'none')

  await fakeModels(legacyModelDir(pluginDir))
  assert.equal(hasModel(legacyModelDir(pluginDir)), true)
  assert.deepEqual(resolveModelDir({ root, pluginDir }), { dir: legacyModelDir(pluginDir), source: 'legacy' })

  await fakeModels(libraryModelDir(root))
  assert.deepEqual(resolveModelDir({ root, pluginDir }), { dir: libraryModelDir(root), source: 'library' })
})

test('模型文件太小视为没装好', async (t) => {
  const base = await mkdtemp(join(tmpdir(), 'expert-models-small-'))
  t.after(() => rm(base, { recursive: true, force: true }))
  const dir = libraryModelDir(base)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'model-fp32.onnx'), 'tiny')
  await writeFile(join(dir, 'vocab.txt'), 'x')
  assert.equal(hasModel(dir), false)
})
