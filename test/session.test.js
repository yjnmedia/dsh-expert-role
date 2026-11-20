import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { ExpertLibrary } from '../lib/library.js'
import { createToolDefinitions, sessionIdOf } from '../lib/tools.js'
import { createRoutes } from '../lib/routes.js'

async function tempLibrary(t) {
  const base = join(process.cwd(), '.tmp')
  await mkdir(base, { recursive: true })
  const root = await mkdtemp(join(base, 'expert-session-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const library = new ExpertLibrary(root)
  await library.ensureRoot()
  return library
}

/** 直接调路由 handler，拿到 JSON 负载。 */
async function call(route, url) {
  const state = { status: 0, body: '' }
  const res = {
    writeHead(code) {
      state.status = code
    },
    end(body) {
      state.body = body
    },
  }
  await route.handler({ url, socket: { remoteAddress: '127.0.0.1' }, headers: {} }, res)
  return { status: state.status, json: JSON.parse(state.body) }
}

test('sessionIdOf 认标准会话字段，认不出返回 undefined', () => {
  assert.equal(sessionIdOf({ agent: { session: { id: 'session-abc' } } }), 'session-abc')
  assert.equal(sessionIdOf({ session: { id: 'session-def' } }), 'session-def')
  assert.equal(sessionIdOf({ sessionId: 'session-ghi' }), 'session-ghi')
  assert.equal(sessionIdOf({}), undefined)
  assert.equal(sessionIdOf(undefined), undefined)
})

test('工具写入的 trace 带上调用方会话', async (t) => {
  const library = await tempLibrary(t)
  const tools = createToolDefinitions(library, {})
  const find = (name) => tools.find((tool) => tool.name === name)
  const exec = { agent: { session: { id: 'session-demo-2-3333-4444-555555555555' } } }

  await find('expert_create').execute({ id: 'demo', title: '演示', description: '测试用' }, exec)
  await find('expert_plan').execute({ expert: 'demo', goal: '查清 A', mode: 'serial', steps: ['第一步'] }, exec)

  const entries = await library.traceTail(10)
  assert.ok(entries.length >= 2)
  for (const entry of entries) {
    assert.equal(entry.session, 'session-demo-2-3333-4444-555555555555', `缺少会话：${JSON.stringify(entry)}`)
  }
})

test('trace 路由给带会话的记录补标题，不带的原样返回', async (t) => {
  const library = await tempLibrary(t)
  await library.appendTrace({ kind: 'skill_load', expert: 'demo', session: 'session-aaaa' })
  await library.appendTrace({ kind: 'plan', expert: 'demo' })

  const routes = createRoutes(library, {
    sessionTitle: async (id) => (id === 'session-aaaa' ? '示例会话 A' : ''),
  })
  const traceRoute = routes.find((route) => route.path === '/expert-role/api/trace')
  const { status, json } = await call(traceRoute, '/expert-role/api/trace?limit=10')
  assert.equal(status, 200)
  const byKind = Object.fromEntries(json.entries.map((entry) => [entry.kind, entry]))
  assert.equal(byKind.skill_load.sessionTitle, '示例会话 A')
  assert.equal('sessionTitle' in byKind.plan, false)
})
