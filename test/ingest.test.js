import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { ExpertLibrary } from '../lib/library.js'
import { addIndexRow, inferMeta, ingestSource } from '../lib/ingest.js'

async function seedExpert() {
  const root = await mkdtemp(join(tmpdir(), 'expert-ingest-'))
  const library = new ExpertLibrary(root)
  const dir = join(root, 'demo')
  await mkdir(join(dir, 'references'), { recursive: true })
  await writeFile(
    join(dir, 'manifest.json'),
    JSON.stringify({
      id: 'demo',
      title: '演示',
      description: '演示专家',
      topics: [{ id: 'prompt', title: '写提示词', whenToUse: '要写提示词时', files: [] }],
    }),
    'utf8',
  )
  await writeFile(join(dir, 'SKILL.md'), '---\nname: expert-demo\ndescription: 演示专家\n---\n\n正文\n', 'utf8')
  await writeFile(join(dir, 'references', 'index.md'), '# 演示 · 资料索引\n\n## 写提示词\n\n| 资料 | 路径 | 一句话 |\n|---|---|---|\n', 'utf8')
  return { root, library }
}

async function seedMaterial(root, name = '新调研', body = '# 提示词新发现\n\n负面词要放在最后，权重 1.2 更稳。第二句不取。\n') {
  const dir = join(root, 'materials', name)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, '调研报告.md'), body, 'utf8')
  return dir
}

test('inferMeta 取首行标题与首段首句', () => {
  const meta = inferMeta('# 提示词新发现\n\n负面词要放在最后。第二句不取。\n', '兜底名')
  assert.equal(meta.title, '提示词新发现')
  assert.equal(meta.summary, '负面词要放在最后。')
  assert.match(meta.useWhen, /提示词新发现/)
  assert.equal(inferMeta('没有标题的正文', '兜底名').title, '兜底名')
})

test('addIndexRow 插到对应主题表格末尾，没有主题就新开一节', () => {
  const base = '# 索引\n\n## 写提示词\n\n| 资料 | 路径 | 一句话 |\n|---|---|---|\n| 旧的 | `a` | 旧的一句话 |\n'
  const next = addIndexRow(base, '写提示词', '新的', 'b', '新的一句话')
  assert.ok(next.indexOf('| 旧的 |') < next.indexOf('| 新的 |'))
  const fresh = addIndexRow(base, '新主题', '新的', 'b', '新的一句话')
  assert.match(fresh, /## 新主题/)
  assert.match(fresh, /\| 新的 \| `b` \| 新的一句话 \|/)
})

test('没给 topic 就进「未归类」，推断字段标 auto', async () => {
  const { root, library } = await seedExpert()
  const dir = await seedMaterial(root)
  const result = await ingestSource(library, { expert: 'demo', source: dir })
  assert.equal(result.topic, '未归类')
  assert.deepEqual(result.autoFields, ['title', 'useWhen', 'summary'])

  const manifest = JSON.parse(await readFile(join(root, 'demo', 'manifest.json'), 'utf8'))
  const unfiled = manifest.topics.find((topic) => topic.title === '未归类')
  assert.equal(unfiled.files.length, 1)
  const rel = unfiled.files[0]
  assert.match(rel, /^references\//, '清单里存相对专家目录的路径')
  assert.ok(manifest.titles[rel], '中文标题记进 titles')
  assert.equal(manifest.autoEntries.length, 1)
  await assert.rejects(() => stat(dir), '原文已被移走，不留副本')
  assert.ok(await stat(join(root, 'demo', ...rel.split('/'))), '资料落到 references 下')

  const index = await readFile(join(root, 'demo', 'references', 'index.md'), 'utf8')
  assert.match(index, /## 未归类/)
  assert.match(index, /自动推断，可改/)
})

test('指定主题与元信息时不再标自动推断，重复登记不重复写', async () => {
  const { root, library } = await seedExpert()
  const dir = await seedMaterial(root)
  const first = await ingestSource(library, {
    expert: 'demo',
    source: dir,
    topic: '写提示词',
    title: '提示词补充',
    useWhen: '要补负面词时',
    summary: '负面词放最后',
  })
  assert.deepEqual(first.autoFields, [])
  assert.equal(first.existed, false)

  const movedManifest = JSON.parse(await readFile(join(root, 'demo', 'manifest.json'), 'utf8'))
  const rel = movedManifest.topics[0].files[0]

  const second = await ingestSource(library, {
    expert: 'demo',
    source: join(root, 'demo', ...rel.split('/')),
    topic: '写提示词',
  })
  assert.equal(second.existed, true)

  const manifest = JSON.parse(await readFile(join(root, 'demo', 'manifest.json'), 'utf8'))
  assert.deepEqual(manifest.topics[0].files, [rel])
  const index = await readFile(join(root, 'demo', 'references', 'index.md'), 'utf8')
  assert.equal(index.split(rel).length - 1, 1, '索引里只出现一次')
})

test('专家不存在或路径读不到都直接报错，不猜', async () => {
  const { library } = await seedExpert()
  await assert.rejects(() => ingestSource(library, { expert: 'nope', source: 'x' }), /专家不存在/)
  await assert.rejects(() => ingestSource(library, { expert: 'demo', source: 'E:/没有这个目录' }), /读不到这份资料/)
})
