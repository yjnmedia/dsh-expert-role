import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ExpertLibrary, parseSurvey } from '../lib/library.js'
import { createToolDefinitions } from '../lib/tools.js'
import { writeSettings } from '../lib/settings.js'
import { runTask, runTasksInParallel, watchWorkspace } from '../lib/dispatch.js'

async function tempLibrary(t) {
  const base = join(process.cwd(), '.tmp')
  await mkdir(base, { recursive: true })
  const root = await mkdtemp(join(base, 'dispatch-test-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const library = new ExpertLibrary(root)
  await library.ensureRoot()
  await writeSettings(root, { research: 'parallel' })
  return library
}

function tools(library, hooks = {}) {
  const list = createToolDefinitions(library, hooks)
  return (name) => list.find((tool) => tool.name === name)
}

async function makeExpert(library) {
  await tools(library)('expert_create').execute({ id: 'demo', title: '演示', description: '演示用' }, {})
  await tools(library)('expert_plan').execute({ expert: 'demo', goal: '查清楚', mode: 'parallel', steps: ['第一件事', '第二件事', '第三件事'] }, {})
}

/** 假宿主：建会话后马上模拟一个回合（一条正文 + turn-stopping）。 */
function fakeCtx({ reply = '结论：三步都做了', stop = true } = {}) {
  const handlers = new Map()
  const sent = []
  return {
    handlers,
    sent,
    agents: {
      async create(options) {
        const agent = {
          id: options.sessionId,
          followup(message) {
            sent.push(message)
            queueMicrotask(() => {
              for (const fn of handlers.get('session/event') ?? []) {
                fn(
                  { header: { id: options.sessionId } },
                  { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: reply }] } } },
                )
              }
              if (stop) {
                for (const fn of handlers.get('agent/turn-stopping') ?? []) fn({ agent })
              }
            })
          },
        }
        return { agent, dispose() {} }
      },
    },
    on(event, fn) {
      if (!handlers.has(event)) handlers.set(event, [])
      handlers.get(event).push(fn)
      return () => {
        const list = handlers.get(event) ?? []
        const index = list.indexOf(fn)
        if (index >= 0) list.splice(index, 1)
      }
    },
  }
}

const model = { provider: 'fake', model: 'fake-model' }

test('runTask 收到正文并在一轮结束时返回', async () => {
  const ctx = fakeCtx({ reply: '三条结论' })
  const result = await runTask(ctx, { model, prompt: '查一下', cwd: process.cwd(), timeoutMs: 5_000 })
  assert.equal(result.error, undefined)
  assert.equal(result.text, '三条结论')
  assert.match(result.sessionId, /^session-expert-task-/)
})

test('runTasksInParallel 保持顺序，且每个任务各建一个会话', async () => {
  const ctx = fakeCtx({ reply: 'ok' })
  const tasks = [1, 2, 3].map((step) => ({ step, text: `第 ${step} 步`, prompt: `做第 ${step} 步` }))
  const results = await runTasksInParallel(ctx, tasks, { model, cwd: process.cwd(), timeoutMs: 5_000, concurrency: 2 })
  assert.deepEqual(results.map((item) => item.step), [1, 2, 3])
  assert.equal(new Set(results.map((item) => item.sessionId)).size, 3)
  assert.equal(ctx.sent.length, 3)
})

test('expert_dispatch 默认真派发，run=false 只出 prompt', async () => {
  const library = await tempLibrary(test)
  await makeExpert(library)
  const calls = []
  const hooks = {
    runTasks: async (tasks) => tasks.map((task) => ({ step: task.step, text: `第 ${task.step} 步结论：dsh-context 的 KPI 栏用 flex 排 4 格，柱状图是 SVG rect，热力图 13px 方格，环形图按 strokeDasharray 百分比切分。`, ms: 12, sessionId: `session-expert-task-${task.step}` })),
  }
  const dispatch = tools(library, hooks)('expert_dispatch')
  const dry = await dispatch.execute({ expert: 'demo', run: false }, {})
  assert.match(dry.text, /子任务 1/)
  assert.equal(calls.length, 0)

  const real = await dispatch.execute({ expert: 'demo' }, {})
  assert.match(real.text, /已真派发 3 个步骤：完成 3/)
  const survey = parseSurvey(await library.readText(join('demo', 'survey.md')))
  assert.deepEqual(survey.steps.map((step) => step.done), [true, true, true])
  assert.equal(survey.records.filter((record) => record.status === 'done').length, 3)
})

test('expert_record 串行时不许跳步，force 才放行', async () => {
  const library = await tempLibrary(test)
  await makeExpert(library)
  const record = tools(library)('expert_record')
  const blocked = await record.execute({ expert: 'demo', step: 3, status: 'done', summary: '跳过前两步' }, {})
  assert.match(blocked.text, /不能跳过/)
  assert.match(blocked.text, /第 1 步/)

  const forced = await record.execute({ expert: 'demo', step: 3, status: 'done', summary: '先验结论，前面两步并入本步', force: true }, {})
  assert.match(forced.text, /已记录/)

  const skipped = await record.execute({ expert: 'demo', step: 2, status: 'skipped', summary: '这步与第 1 步重复' }, {})
  assert.match(skipped.text, /已记录/)
})

test('watchWorkspace 把工作区产出收成一条进度记录', async () => {
  const library = await tempLibrary(test)
  await makeExpert(library)
  const outDir = join(library.root, 'demo', 'workspace', 'out')
  await mkdir(outDir, { recursive: true })
  await writeFile(join(outDir, '01-结论.md'), '# 结论\n\n行高 1.6，字号 16。', 'utf8')

  const ctx = fakeCtx()
  const off = watchWorkspace({ ctx, library, expertId: 'demo', sessionId: 'session-expert-demo-1', outDir })
  for (const fn of ctx.handlers.get('agent/turn-stopping') ?? []) {
    await fn({ agent: { id: 'session-expert-demo-1' } })
  }
  off()

  const survey = parseSurvey(await library.readText(join('demo', 'survey.md')))
  assert.equal(survey.records.length, 1)
  assert.match(survey.records[0].note, /工作区产出 1 份/)
  assert.match(survey.records[0].note, /行高 1.6/)
  assert.equal(survey.steps[0].done, true)
})

test('watchWorkspace 在步骤已全部做完时不凭空造下一步', async () => {
  const library = await tempLibrary(test)
  await makeExpert(library)
  const record = tools(library)('expert_record')
  for (const step of [1, 2, 3]) {
    await record.execute({ expert: 'demo', step, status: 'done', summary: `第 ${step} 步做完` }, {})
  }
  const outDir = join(library.root, 'demo', 'workspace', 'out')
  await mkdir(outDir, { recursive: true })
  await writeFile(join(outDir, '01-结论.md'), '# 结论\n\n补查完毕。', 'utf8')

  const ctx = fakeCtx()
  watchWorkspace({ ctx, library, expertId: 'demo', sessionId: 'session-expert-demo-2', outDir })
  for (const fn of ctx.handlers.get('agent/turn-stopping') ?? []) {
    await fn({ agent: { id: 'session-expert-demo-2' } })
  }

  const survey = parseSurvey(await library.readText(join('demo', 'survey.md')))
  assert.equal(survey.steps.length, 3)
  const last = survey.records.at(-1)
  assert.equal(String(last.step), '3')
  assert.match(last.note, /工作区产出 1 份/)
})
