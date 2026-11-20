import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ExpertLibrary, MISSING_GUIDE } from '../lib/library.js'
import { createExpertProvider } from '../lib/provider.js'
import { createToolDefinitions } from '../lib/tools.js'

async function setup() {
  const root = await mkdtemp(join(tmpdir(), 'expert-find-'))
  const library = new ExpertLibrary(root)
  await library.ensureRoot()
  await mkdir(join(root, 'ui-design', 'references'), { recursive: true })
  await writeFile(
    join(root, 'ui-design', 'SKILL.md'),
    ['---', 'name: expert-ui-design', 'description: 界面与交互资料库', '---', '', '# 界面与交互', ''].join('\n'),
    'utf8',
  )
  await writeFile(
    join(root, 'ui-design', 'manifest.json'),
    JSON.stringify({
      id: 'ui-design',
      title: '界面与交互',
      description: '界面与交互资料库',
      topics: [{ id: 'typography', title: '排版与字号', whenToUse: '要定字号、行高时', files: ['E:\\docs\\typography.md'] }],
    }, null, 2),
    'utf8',
  )
  await writeFile(
    join(root, 'ui-design', 'references', 'index.md'),
    ['# 界面与交互 · 资料索引', '', '| 资料 | 路径 | 一句话 |', '|---|---|---|', '| 提示形态调研 | `E:\\docs\\feedback` | 完成提示选哪种形态 |'].join('\n'),
    'utf8',
  )
  const tools = Object.fromEntries(createToolDefinitions(library).map((tool) => [tool.name, tool]))
  return { root, library, tools }
}

test('expert_find 命中主题与索引行', async () => {
  const { tools } = await setup()
  const hitTopic = await tools.expert_find.execute({ query: '行高' }, {})
  assert.equal(hitTopic.missing, false)
  assert.ok(hitTopic.count >= 1)
  assert.match(hitTopic.text, /排版与字号/)

  const hitIndex = await tools.expert_find.execute({ query: '提示形态' }, {})
  assert.equal(hitIndex.missing, false)
  assert.match(hitIndex.text, /提示形态调研/)
})

test('expert_find 查不到时给出两个选项并要求先问用户', async () => {
  const { tools } = await setup()
  const miss = await tools.expert_find.execute({ query: '视频编码 码率' }, {})
  assert.equal(miss.missing, true)
  assert.equal(miss.count, 0)
  assert.match(miss.text, /没有覆盖/)
  assert.match(miss.text, /A：/)
  assert.match(miss.text, /B：/)
  assert.match(miss.text, /先问用户/)
})

test('expert_find 可以限定专家，空关键词直接判缺', async () => {
  const { tools } = await setup()
  const scoped = await tools.expert_find.execute({ query: '行高', expert: 'ui-design' }, {})
  assert.equal(scoped.missing, false)
  const blank = await tools.expert_find.execute({ query: '  ' }, {})
  assert.equal(blank.missing, true)
})

test('provider 返回的正文一定带兜底说明，且不重复追加', async () => {
  const { library } = await setup()
  const provider = createExpertProvider(library)
  const [candidate] = await provider.list({ cwd: '.' })
  const definition = await provider.get(candidate)
  assert.ok(definition.content.includes('资料库没覆盖时'))
  assert.equal(definition.content.split(MISSING_GUIDE).length, 2)
})
