import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ExpertLibrary } from '../lib/library.js'
import { createToolDefinitions } from '../lib/tools.js'
import { readSettings, writeSettings, DEFAULT_RESEARCH } from '../lib/settings.js'

async function tempLibrary(t) {
  const base = join(process.cwd(), '.tmp')
  await mkdir(base, { recursive: true })
  const root = await mkdtemp(join(base, 'gate-test-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const library = new ExpertLibrary(root)
  await library.ensureRoot()
  return library
}

function tools(library, hooks = {}) {
  const list = createToolDefinitions(library, hooks)
  return (name) => list.find((tool) => tool.name === name)
}

async function makeExpert(library) {
  await tools(library)('expert_create').execute({ id: 'demo', title: '演示', description: '演示用' }, {})
  await tools(library)('expert_plan').execute({ expert: 'demo', goal: '查清楚', steps: ['第一件事', '第二件事'] }, {})
}

test('一条条查：expert_dispatch 不建会话，直接拒绝并指向 expert_next', async (t) => {
  const library = await tempLibrary(t)
  await makeExpert(library)
  await writeSettings(library.root, { research: 'serial' })
  let called = 0
  const tool = tools(library, { runTasks: async () => { called += 1; return [] } })('expert_dispatch')
  const result = await tool.execute({ expert: 'demo' }, {})
  assert.equal(called, 0, '串行档不许派发')
  assert.match(result.text, /没有派发/)
  assert.match(result.text, /expert_next/)
})

test('一条条查：expert_workspace 拒绝开新会话', async (t) => {
  const library = await tempLibrary(t)
  await makeExpert(library)
  await writeSettings(library.root, { research: 'serial' })
  let opened = 0
  const tool = tools(library, { openWorkspace: async () => { opened += 1; return { sessionId: 'x' } } })('expert_workspace')
  const result = await tool.execute({ expert: 'demo' }, {})
  assert.equal(opened, 0)
  assert.match(result.text, /没有开工作区/)
})

test('并行档：expert_dispatch 正常派发', async (t) => {
  const library = await tempLibrary(t)
  await makeExpert(library)
  await writeSettings(library.root, { research: 'parallel' })
  const seen = []
  const tool = tools(library, {
    runTasks: async (tasks) => tasks.map((task) => ({ step: task.step, text: '做完了，结论：够用', error: null, ms: 10, sessionId: 'session-expert-task-1' })),
  })('expert_dispatch')
  const result = await tool.execute({ expert: 'demo' }, {})
  seen.push(result.text)
  assert.match(result.text, /已真派发|完成/)
})

test('工作区档暂停：设置里写 workspace 会被拒绝，读到也退回串行', async (t) => {
  const library = await tempLibrary(t)
  await assert.rejects(() => writeSettings(library.root, { research: 'workspace' }), /暂停使用/)
  const settings = await readSettings(library.root)
  assert.equal(settings.research, DEFAULT_RESEARCH)
  await writeFile(join(library.root, 'settings.json'), JSON.stringify({ research: 'workspace' }), 'utf8')
  const after = await readSettings(library.root)
  assert.equal(after.research, DEFAULT_RESEARCH)
})

test('工作区会话 id 记进 manifest，再次读取仍在（供以后复用）', async (t) => {
  const library = await tempLibrary(t)
  await makeExpert(library)
  await library.setWorkspaceSession('demo', 'session-expert-demo-1794')
  const expert = await library.readExpert('demo')
  assert.equal(expert.workspaceSessionId, 'session-expert-demo-1794')
  const raw = JSON.parse(await readFile(join(library.root, 'demo', 'manifest.json'), 'utf8'))
  assert.equal(raw.workspaceSessionId, 'session-expert-demo-1794')
  // 再写一次计划，不能被 renderManifest 抹掉
  await tools(library)('expert_plan').execute({ expert: 'demo', goal: '改个目标' }, {})
  const raw2 = JSON.parse(await readFile(join(library.root, 'demo', 'manifest.json'), 'utf8'))
  assert.equal(raw2.workspaceSessionId, 'session-expert-demo-1794')
})

test('暂停期间：settings 里写着 workspace 也照样被拦（并退回串行）', async (t) => {
  const library = await tempLibrary(t)
  await makeExpert(library)
  await writeFile(join(library.root, 'settings.json'), JSON.stringify({ research: 'workspace' }), 'utf8')
  let opened = 0
  const tool = tools(library, { openWorkspace: async () => { opened += 1; return { sessionId: 'x' } } })('expert_workspace')
  const result = await tool.execute({ expert: 'demo' }, {})
  assert.equal(opened, 0)
  assert.match(result.text, /没有开工作区/)
})
