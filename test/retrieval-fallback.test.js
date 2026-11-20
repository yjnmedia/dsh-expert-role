import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRetriever } from '../lib/retrieval.js'
import { ExpertLibrary } from '../lib/library.js'

// 没有本地模型时不能让检索整体挂掉：退化为关键词匹配，工具照样能用。
async function makeLibrary() {
  const dir = await mkdtemp(join(tmpdir(), 'no-model-'))
  const lib = new ExpertLibrary(dir)
  return { dir, lib }
}

test('模型目录不存在时退回关键词检索', async () => {
  const { dir, lib } = await makeLibrary()
  try {
    const retriever = await createRetriever({
      library: lib,
      experts: [
        {
          id: 'demo',
          title: '演示专家',
          level1: '界面与体验',
          topics: [{ title: '排版', files: [{ rel: 'a.md', title: '正文行高与字号' }] }],
        },
      ],
      cachePath: join(dir, '.cache', 'docindex.json'),
      baseDir: join(dir, 'no-such-model'),
    })
    assert.equal(retriever.mode, 'lexical')
    const result = await retriever.retrieve('正文行高怎么定', { k: 1 })
    assert.ok(Array.isArray(result.top))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
