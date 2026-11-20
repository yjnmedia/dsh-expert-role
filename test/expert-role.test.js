import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import {
  ExpertLibrary,
  isInside,
  parseFrontmatter,
  parseSurvey,
  renderManifest,
  renderSurvey,
  slugify,
} from '../lib/library.js'
import { createToolDefinitions } from '../lib/tools.js'
import { writeSettings } from '../lib/settings.js'
import { formatBadge } from '../lib/trace.js'

async function tempLibrary(t) {
  const base = join(process.cwd(), '.tmp')
  await mkdir(base, { recursive: true })
  const root = await mkdtemp(join(base, 'expert-test-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const library = new ExpertLibrary(root)
  await library.ensureRoot()
  return library
}

function toolByName(library, name) {
  return createToolDefinitions(library).find((tool) => tool.name === name)
}

test('renderManifest 保留 topics', () => {
  const manifest = renderManifest({ id: 'ui-design', title: '界面与交互', description: 'd', mode: 'serial', topics: [{ id: 'visual', files: ['a.md'] }] })
  assert.equal(manifest.topics.length, 1)
  assert.equal(renderManifest({ id: 'x', title: 't', description: 'd', mode: 'serial' }).topics, undefined)
})

test('parseFrontmatter 读出 name/description/when-to-use', () => {
  const { data, body } = parseFrontmatter('---\nname: expert-ai-image\ndescription: "AI 生图专家"\nwhen-to-use: 做生图时\n---\n\n# 正文\n')
  assert.equal(data.name, 'expert-ai-image')
  assert.equal(data.description, 'AI 生图专家')
  assert.equal(data['when-to-use'], '做生图时')
  assert.equal(body.trim(), '# 正文')
})

test('parseFrontmatter 无头时原样返回', () => {
  const { data, body } = parseFrontmatter('# 只是正文\n')
  assert.deepEqual(data, {})
  assert.equal(body, '# 只是正文\n')
})

test('isInside 拦越界路径', () => {
  assert.equal(isInside('C:/AIExperts', 'C:/AIExperts/ai-image/SKILL.md'), true)
  assert.equal(isInside('C:/AIExperts', 'C:/AIExperts2/x.md'), false)
  assert.equal(isInside('C:/AIExperts', 'C:/other.md'), false)
})

test('slugify 生成 kebab-case', () => {
  assert.equal(slugify('AI 生图'), 'ai-生图')
  assert.match(slugify('  '), /^expert-\d+$/)
})

test('renderSurvey / parseSurvey 往返一致', () => {
  const text = renderSurvey({
    title: 'AI 生图 · 尽调计划',
    goal: '搞清各家平台差异',
    mode: 'parallel',
    steps: [{ text: '查平台 A', done: true }, { text: '查平台 B', done: false }],
    records: [{ step: 1, status: 'done', note: 'A 支持 4K | 已核对', at: '2026-11-15 12:00' }],
  })
  const parsed = parseSurvey(text)
  assert.equal(parsed.mode, 'parallel')
  assert.equal(parsed.goal, '搞清各家平台差异')
  assert.deepEqual(parsed.steps.map((step) => [step.index, step.done, step.text]), [
    [1, true, '查平台 A'],
    [2, false, '查平台 B'],
  ])
  assert.equal(parsed.records[0].status, 'done')
  assert.equal(parsed.records[0].note, 'A 支持 4K / 已核对')
})

test('library 拒绝越界读写', async (t) => {
  const library = await tempLibrary(t)
  await assert.rejects(() => library.writeText('../escape.md', 'x'), /路径越界/)
  await assert.rejects(() => library.readText('C:/Windows/win.ini'), /相对路径/)
})

test('expert_create → plan → record → status 全链路', async (t) => {
  const library = await tempLibrary(t)
  const created = await toolByName(library, 'expert_create').execute({
    id: 'ai-image',
    title: 'AI 生图',
    description: '管生图平台、模型与提示词资料',
  })
  assert.match(created.text, /已创建专家 ai-image/)

  const experts = await library.listExperts()
  assert.equal(experts.length, 1)
  assert.equal(experts[0].skillName, 'expert-ai-image')
  assert.equal(experts[0].status, 'draft')

  await toolByName(library, 'expert_plan').execute({
    expert: 'ai-image',
    goal: '搞清 Seedream 与 Nano Banana 的差异',
    mode: 'parallel',
    steps: ['查官方文档', '查实测对比'],
  })

  await toolByName(library, 'expert_record').execute({
    expert: 'ai-image',
    step: 1,
    status: 'done',
    summary: 'Seedream 4 支持 4K 输出',
    markStepDone: true,
  })

  const status = await toolByName(library, 'expert_status').execute({ expert: 'ai-image' })
  assert.match(status.text, /\[x\] 1\. 查官方文档/)
  assert.match(status.text, /\[ \] 2\. 查实测对比/)
  assert.match(status.text, /Seedream 4 支持 4K 输出/)

  const expert = await library.readExpert('ai-image')
  assert.equal(expert.mode, 'parallel')
  const trace = await library.traceTail(20)
  assert.ok(trace.some((entry) => entry.kind === 'plan'))
  assert.ok(trace.some((entry) => entry.kind === 'write' && entry.expert === 'ai-image'))
  const files = await library.listFiles('ai-image')
  assert.ok(files.some((file) => file.path === 'ai-image/SKILL.md'))
})

test('expert_create 已存在时不覆盖', async (t) => {
  const library = await tempLibrary(t)
  const create = toolByName(library, 'expert_create')
  await create.execute({ id: 'ai-image', title: 'AI 生图', description: '原描述' })
  const second = await create.execute({ id: 'ai-image', title: '改标题', description: '新描述' })
  assert.match(second.text, /已存在/)
  const expert = await library.readExpert('ai-image')
  assert.equal(expert.title, 'AI 生图')
})

test('expertOfPath 只认专家根目录下的文件', async (t) => {
  const library = await tempLibrary(t)
  await library.writeText('ai-image/references/a.md', 'x')
  assert.equal(await library.expertOfPath(join(library.root, 'ai-image', 'references', 'a.md')), 'ai-image')
  assert.equal(await library.expertOfPath(join(library.root, '.trace', 'trace.jsonl')), undefined)
  assert.equal(await library.expertOfPath('C:/elsewhere/a.md'), undefined)
})

test('expert_dispatch 用未完成步骤切片，并给出合并提示', async (t) => {
  const library = await tempLibrary(t)
  await writeSettings(library.root, { research: 'parallel' })
  const create = toolByName(library, 'expert_create')
  await create.execute({ id: 'dispatch-test', title: '派发测试', description: 'd', whenToUse: 'w' })
  await toolByName(library, 'expert_plan').execute({
    expert: 'dispatch-test',
    goal: '验证切片',
    mode: 'parallel',
    steps: ['第一步查资料', '第二步做对照'],
  })
  await toolByName(library, 'expert_record').execute({
    expert: 'dispatch-test',
    step: 1,
    status: 'done',
    summary: '第一步已完成',
    markStepDone: true,
  })
  const dispatch = toolByName(library, 'expert_dispatch')
  const result = await dispatch.execute({ expert: 'dispatch-test' })
  assert.equal(result.count, 1, '只应派发未完成的 1 步')
  assert.match(result.text, /第二步做对照/)
  assert.doesNotMatch(result.text, /第一步查资料/)
  assert.match(result.text, /00-合并摘要\.md/)
  assert.match(result.text, /subagent 工具一次发出 1 个/)

  const explicit = await dispatch.execute({ expert: 'dispatch-test', steps: ['自定义 A', '自定义 B'] })
  assert.equal(explicit.count, 2)
  assert.match(explicit.text, /自定义 A/)
  assert.match(explicit.text, /自定义 B/)
})

test('expert_workspace 写下 brief.md 并给出开场提示', async (t) => {
  const library = await tempLibrary(t)
  process.env.DSH_EXPERT_ENABLE_WORKSPACE = '1'
  await writeSettings(library.root, { research: 'workspace' })
  await toolByName(library, 'expert_create').execute({ id: 'ws-test', title: '工作区测试', description: 'd', whenToUse: 'w' })
  await toolByName(library, 'expert_plan').execute({ expert: 'ws-test', goal: '查清三件事', mode: 'workspace', steps: ['查 A', '查 B'] })
  const result = await toolByName(library, 'expert_workspace').execute({ expert: 'ws-test' })
  assert.match(result.text, /工作区已建/)
  assert.match(result.text, /brief\.md/)
  const brief = await library.readText('ws-test/workspace/brief.md')
  assert.match(brief, /查清三件事/)
  assert.match(brief, /1\. 查 A/)
  assert.match(brief, /expert_record/)
  await assert.rejects(() => toolByName(library, 'expert_workspace').execute({ expert: '../x' }))
})

test('formatBadge 只给 skill_load 与 ref_read 出提示', () => {
  assert.match(formatBadge({ kind: 'skill_load', expert: 'ai-image', skill: 'expert-ai-image', chars: 661 }), /加载技能 expert-ai-image（661 字）/)
  assert.match(formatBadge({ kind: 'ref_read', expert: 'ai-image', path: 'ai-image/references/01-提示词.md', chars: 12_000 }), /读 ai-image\/references\/01-提示词\.md（12K 字）/)
  assert.equal(formatBadge({ kind: 'write', expert: 'ai-image', path: 'x' }), undefined)
})
