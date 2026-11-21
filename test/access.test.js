import test from 'node:test'
import assert from 'node:assert/strict'
import { createRoutes } from '../lib/routes.js'
import { createGuard, connectionVerdict } from '../lib/access.js'

// 假 ctx：只提供 ctx.get('connection')。
function fakeCtx(connection) {
  return { get: (name) => (name === 'connection' ? connection : undefined) }
}

// 假 req / res，够跑通 route handler。
function fakePair() {
  const calls = []
  const res = {
    statusCode: 0,
    headers: {},
    body: '',
    writeHead(code, headers) {
      this.statusCode = code
      this.headers = headers ?? {}
    },
    end(body) {
      this.body = body ?? ''
    },
  }
  const req = { socket: { remoteAddress: '127.0.0.1' }, url: '/expert-role/api/stats', method: 'GET' }
  return { req, res, calls }
}

test('宿主放行时请求进入业务逻辑', async () => {
  const routes = createRoutes({ root: 'X:/experts' }, { isAllowed: () => true })
  const picked = routes.find((r) => r.path === '/expert-role/api/stats')
  const { req, res } = fakePair()
  await picked.handler(req, res)
  assert.notEqual(res.statusCode, 403)
})

test('宿主拒绝时返回 403 且不进入业务逻辑', async () => {
  const routes = createRoutes({ root: 'X:/experts' }, { isAllowed: () => false })
  const picked = routes.find((r) => r.path === '/expert-role/api/stats')
  const { req, res } = fakePair()
  await picked.handler(req, res)
  assert.equal(res.statusCode, 403)
  assert.match(res.body, /forbidden/)
})

test('没有守卫时退回本机判断，不误伤面板', async () => {
  const routes = createRoutes({ root: 'X:/experts' })
  const picked = routes.find((r) => r.path === '/expert-role/api/stats')
  const { req, res } = fakePair()
  await picked.handler(req, res)
  assert.notEqual(res.statusCode, 403)
})

test('admit 返回 peer 才放行', () => {
  const req = {}
  assert.equal(connectionVerdict({ admit: () => ({ peer: { id: 'p' } }) }, req), 'allow')
  assert.equal(connectionVerdict({ admit: () => ({ rejection: 'nope' }) }, req), 'deny')
  assert.equal(connectionVerdict({ admit: () => ({}) }, req), 'deny')
})

test('旧宿主用 requestRejection，undefined 表示放行', () => {
  const req = {}
  assert.equal(connectionVerdict({ requestRejection: () => undefined }, req), 'allow')
  assert.equal(connectionVerdict({ requestRejection: () => 'forbidden' }, req), 'deny')
})

test('宿主没有准入服务时不拦（旧版本兼容）', () => {
  const guard = createGuard(fakeCtx(undefined))
  assert.equal(guard({}), true)
})

test('准入服务抛错时按未知处理，不锁死面板', () => {
  const guard = createGuard(
    fakeCtx({
      admit: () => {
        throw new Error('boom')
      },
    }),
  )
  assert.equal(guard({}), true)
})

test('createGuard 真的用宿主的 admit 拦人', () => {
  const deny = createGuard(fakeCtx({ admit: () => ({ rejection: 'forbidden' }) }))
  const allow = createGuard(fakeCtx({ admit: () => ({ peer: { id: 'p' } }) }))
  assert.equal(deny({}), false)
  assert.equal(allow({}), true)
})
