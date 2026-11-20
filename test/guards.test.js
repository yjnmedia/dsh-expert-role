import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { ExpertLibrary, sessionTitleOf } from '../lib/library.js'
import { createToolDefinitions, isDispatchChild, looksUnfinished } from '../lib/tools.js'
import { writeSettings } from '../lib/settings.js'

async function tempLibrary(t) {
  const base = join(process.cwd(), '.tmp')
  await mkdir(base, { recursive: true })
  const root = await mkdtemp(join(base, 'guards-test-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const library = new ExpertLibrary(root)
  await writeSettings(root, { research: 'parallel' })
  await library.ensureRoot()
  return library
}

function toolOf(library, name, hooks = {}) {
  return createToolDefinitions(library, hooks).find((tool) => tool.name === name)
}

const childExec = (id = 'session-expert-task-1234') => ({ agent: { session: { id } } })

test('isDispatchChild 只认派发子会话', () => {
  assert.equal(isDispatchChild(childExec()), true)
  assert.equal(isDispatchChild({ agent: { session: { id: 'session-11111111-2222-3333-4444-555555555555' } } }), false)
  assert.equal(isDispatchChild({}), false)
})

test('looksUnfinished 认得出「没有工具 / 做不了」', () => {
  assert.equal(looksUnfinished('本子会话没有文件读写与执行工具，读不了 references 下任何文件，这一步做不了。'), true)
  assert.equal(looksUnfinished('短'), true)
  assert.equal(
    looksUnfinished('第 2 步完成：dsh-context 的 KPI 栏用 flex 排 4 格，柱状图是 SVG rect，热力图 13px 方格，环形图 strokeDasharray 按百分比切分。'),
    false,
  )
})

test('子会话里 expert_record / expert_workspace / expert_dispatch 都被挡住', async () => {
  const library = await tempLibrary(test)
  await toolOf(library, 'expert_create').execute({ id: 'demo', title: '演示', description: '演示用' }, {})
  await toolOf(library, 'expert_plan').execute({ expert: 'demo', steps: ['第一件事'] }, {})

  const record = await toolOf(library, 'expert_record').execute({ expert: 'demo', step: 1, status: 'done', summary: '做完了' }, childExec())
  assert.match(record.text, /别自己调 expert_record/)
  const workspace = await toolOf(library, 'expert_workspace').execute({ expert: 'demo' }, childExec())
  assert.match(workspace.text, /不要再开工作区/)
  const dispatch = await toolOf(library, 'expert_dispatch').execute({ expert: 'demo' }, childExec())
  assert.match(dispatch.text, /不能再向外派发/)

  const survey = await library.readSurvey('demo')
  assert.equal(survey.records.length, 0)
  assert.equal(survey.steps[0].done, false)
})

test('派发结果其实是「做不了」时记 blocked，不记 done', async () => {
  const library = await tempLibrary(test)
  await toolOf(library, 'expert_create').execute({ id: 'demo', title: '演示', description: '演示用' }, {})
  await toolOf(library, 'expert_plan').execute({ expert: 'demo', steps: ['第一步'] }, [])
  const hooks = {
    runTasks: async (tasks) => tasks.map((task) => ({
      ...task,
      sessionId: 'session-expert-task-x',
      text: '本会话没有读写工具，这一步做不了，需要宿主先给我文件工具。',
      ms: 1000,
    })),
  }
  const result = await toolOf(library, 'expert_dispatch', hooks).execute({ expert: 'demo' }, {})
  assert.match(result.text, /完成 0，失败 1/)
  const survey = await library.readSurvey('demo')
  assert.equal(survey.records[0].status, 'blocked')
  assert.equal(survey.steps[0].done, false)
})

test('sessionTitleOf 接受插件自己建的会话 id', async () => {
  // 读不到缓存文件就返回空串，但不应因为 id 形状被提前拒掉
  const title = await sessionTitleOf('session-expert-task-0d0d0d0d-1111-2222-3333-444444444444')
  assert.equal(typeof title, 'string')
  assert.equal(await sessionTitleOf('../../etc/passwd'), '')
  assert.equal(await sessionTitleOf(''), '')
})
