import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { ExpertLibrary } from '../lib/library.js'
import { createToolDefinitions } from '../lib/tools.js'

// 工作区档现在默认暂停；这两个用例测的是"档位打开后"的行为，所以显式打开。
process.env.DSH_EXPERT_ENABLE_WORKSPACE = '1'
import { writeSettings } from '../lib/settings.js'
import { openSession, modelOf, userMessage } from '../lib/session.js'

async function tempLibrary(t) {
  const base = join(process.cwd(), '.tmp')
  await mkdir(base, { recursive: true })
  const root = await mkdtemp(join(base, 'session-test-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const library = new ExpertLibrary(root)
  await library.ensureRoot()
  await writeSettings(root, { research: 'workspace' })
  return library
}

test('modelOf 只认完整的 provider/model', () => {
  const ok = { agent: { model: { current: () => ({ provider: 'deepseek-official', model: 'deepseek-flash' }) } } }
  assert.deepEqual(modelOf(ok), { provider: 'deepseek-official', model: 'deepseek-flash' })
  assert.equal(modelOf({ agent: { model: { current: () => undefined } } }), undefined)
  assert.equal(modelOf({ agent: { model: { current: () => { throw new Error('boom') } } } }), undefined)
  assert.equal(modelOf(undefined), undefined)
})

test('userMessage 结构与宿主一致', () => {
  const message = userMessage('你好')
  assert.equal(message.role, 'user')
  assert.equal(message.source.kind, 'user')
  assert.deepEqual(message.content, [{ type: 'text', text: '你好' }])
  assert.equal(typeof message.id, 'string')
  assert.ok(message.id.length > 10)
})

test('openSession 建会话并把开场消息投进去', async () => {
  const calls = []
  let delivered
  const ctx = {
    agents: {
      async create(options) {
        calls.push(options)
        return { agent: { followup: (message) => { delivered = message } }, dispose() {} }
      },
    },
  }
  const result = await openSession({
    ctx,
    cwd: 'C:/data/ai-image/workspace',
    kickoff: '先读简报',
    model: { provider: 'p', model: 'm' },
    sessionId: 'session-expert-ai-image-1',
  })
  assert.equal(result.sessionId, 'session-expert-ai-image-1')
  assert.equal(result.error, undefined)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].sessionId, 'session-expert-ai-image-1')
  assert.equal(calls[0].meta.cwd, 'C:/data/ai-image/workspace')
  assert.deepEqual(calls[0].agentOptions, { provider: 'p', model: 'm' })
  assert.equal(delivered.content[0].text, '先读简报')
})

test('openSession 没有 agents 服务时给出原因，不抛错', async () => {
  const result = await openSession({ ctx: {}, cwd: '.', kickoff: 'x' })
  assert.equal(result.sessionId, null)
  assert.match(result.error, /没有 agents 服务/)
})

test('openSession 建会话失败时不抛错', async () => {
  const ctx = { agents: { async create() { throw new Error('会话 id 冲突') } } }
  const result = await openSession({ ctx, cwd: '.', kickoff: 'x' })
  assert.equal(result.sessionId, null)
  assert.match(result.error, /会话 id 冲突/)
})

test('expert_workspace 能自动开会话并记 workspace trace', async (t) => {
  const library = await tempLibrary(t)
  const defs = createToolDefinitions(library, {
    openSession: async ({ expertId, cwd }) => ({ sessionId: `session-expert-${expertId}-9` }),
  })
  const byName = Object.fromEntries(defs.map((def) => [def.name, def]))
  await byName.expert_create.execute({ id: 'demo', title: '演示', description: '演示' }, {})
  await writeSettings(library.root, { research: 'workspace' })
  const out = await byName.expert_workspace.execute({ expert: 'demo' }, {})
  assert.match(out.text, /新会话已开好：session-expert-demo-9/)
  assert.equal(out.count, 1)
  const trace = await library.traceTail(10)
  assert.ok(trace.some((entry) => entry.kind === 'workspace' && entry.session === 'session-expert-demo-9'))
})

test('expert_workspace 开会话失败时退回提示文案', async (t) => {
  const library = await tempLibrary(t)
  const defs = createToolDefinitions(library, {
    openSession: async () => ({ sessionId: null, error: '当前宿主没有 agents 服务，建不了会话' }),
  })
  const byName = Object.fromEntries(defs.map((def) => [def.name, def]))
  await byName.expert_create.execute({ id: 'demo', title: '演示', description: '演示' }, {})
  await writeSettings(library.root, { research: 'workspace' })
  const out = await byName.expert_workspace.execute({ expert: 'demo' }, {})
  assert.match(out.text, /没能自动开新会话/)
  assert.match(out.text, /在新会话里开场用这段/)
  assert.equal(out.count, 0)
})
