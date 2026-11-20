import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ExpertLibrary } from '../lib/library.js'
import { createRoutes } from '../lib/routes.js'
import { createToolDefinitions } from '../lib/tools.js'

const createTools = (lib) => createToolDefinitions(lib, {})

async function makeIo() {
  const lib = new ExpertLibrary(mkdtempSync(join(tmpdir(), 'expert-routes-')))
  await lib.ensureRoot()
  return { lib, done: () => rmSync(lib.root, { recursive: true, force: true }) }
}

function fakeReq(url, { remote = '127.0.0.1' } = {}) {
  return { url, socket: { remoteAddress: remote }, headers: { host: '127.0.0.1:1234' } }
}

function fakeRes() {
  const state = { status: 0, headers: {}, body: '' }
  return {
    state,
    writeHead(code, headers) { state.status = code; Object.assign(state.headers, headers || {}); return this },
    end(body) { state.body = body || '' },
  }
}

const routeOf = (routes, path) => routes.find((r) => r.path === path)

test('routes: 非本地地址一律 403', async () => {
  const { lib, done } = await makeIo()
  try {
    const routes = createRoutes(lib)
    for (const r of routes) {
      const res = fakeRes()
      await r.handler(fakeReq(r.path, { remote: '10.0.0.7' }), res)
      assert.equal(res.state.status, 403, `${r.path} 应拒绝外部地址`)
    }
  } finally { done() }
})

test('routes: /experts 返回 JSON 列表', async () => {
  const { lib, done } = await makeIo()
  try {
    await createTools(lib).find((t) => t.name === 'expert_create').execute({ id: 'routes-probe', title: '路由探针', description: 'd', whenToUse: 'w' })
    const routes = createRoutes(lib)
    const res = fakeRes()
    await routeOf(routes, '/expert-role/api/experts').handler(fakeReq('/expert-role/api/experts'), res)
    assert.equal(res.state.status, 200)
    assert.match(res.state.headers['content-type'] ?? '', /application\/json/)
    const data = JSON.parse(res.state.body)
    assert.ok(Array.isArray(data.experts))
    assert.equal(data.experts[0].id, 'routes-probe')
  } finally { done() }
})

test('routes: /file 越界路径被拒绝', async () => {
  const { lib, done } = await makeIo()
  try {
    await createTools(lib).find((t) => t.name === 'expert_create').execute({ id: 'routes-probe', title: 't', description: 'd', whenToUse: 'w' })
    const routes = createRoutes(lib)
    const res = fakeRes()
    const target = encodeURIComponent(join(tmpdir(), 'outside-expert-root-' + process.pid + '.txt'))
    await routeOf(routes, '/expert-role/api/file').handler(fakeReq(`/expert-role/api/file?path=${target}`), res)
    assert.notEqual(res.state.status, 200, '库外文件不得读取')
  } finally { done() }
})

test('routes: /trace 返回记录数组', async () => {
  const { lib, done } = await makeIo()
  try {
    await lib.appendTrace({ kind: 'skill_load', expert: 'routes-probe', path: 'SKILL.md' })
    const routes = createRoutes(lib)
    const res = fakeRes()
    await routeOf(routes, '/expert-role/api/trace').handler(fakeReq('/expert-role/api/trace?limit=10'), res)
    assert.equal(res.state.status, 200)
    const data = JSON.parse(res.state.body)
    assert.ok(Array.isArray(data.entries))
    assert.equal(data.entries[0].kind, 'skill_load')
  } finally { done() }
})
