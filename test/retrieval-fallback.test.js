import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { ExpertLibrary } from '../lib/library.js'
import { createRetriever } from '../lib/retrieval.js'

async function demoLibrary(t) {
  const root = await mkdtemp(join(tmpdir(), 'expert-fallback-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const dir = join(root, 'demo')
  await mkdir(join(dir, 'references'), { recursive: true })
  await writeFile(join(dir, 'SKILL.md'), '---\nname: expert-demo\ndescription: 演示\n---\n\n# 演示\n')
  await writeFile(
    join(dir, 'manifest.json'),
    JSON.stringify({
      id: 'demo',
      title: '演示专家',
      level1: '工程技术',
      topics: [{ id: 'row', title: '行高', whenToUse: '调行高时', files: ['references/row.md'] }],
      titles: { 'references/row.md': '行高的取值' },
      summaries: { '行高的取值': '正文 14px 配 22px 行高，两行之间留 4px。' },
      queries: { '行高的取值': ['行高', '行距'] },
    }, null, 2)
  )
  await writeFile(join(dir, 'references', 'row.md'), '# 行高的取值\n\n正文 14px 配 22px 行高，两行之间留 4px。\n')
  return new ExpertLibrary(root)
}

test('没有向量模型时降级成关键词检索，仍能命中', async (t) => {
  const library = await demoLibrary(t)
  const experts = await library.listExperts()
  const retriever = await createRetriever({
    library,
    experts,
    cachePath: join(library.root, '.cache', 'docindex.json'),
    baseDir: join(library.root, 'no-model-here'),
  })
  const result = await retriever.retrieve('行高怎么配', { k: 3 })
  assert.equal(retriever.mode, 'lexical')
  assert.ok(result.top.length > 0, '关键词检索没命中')
  assert.match(result.top[0].title, /行高/)
})
