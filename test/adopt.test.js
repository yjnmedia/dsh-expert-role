import test from 'node:test'
import assert from 'node:assert/strict'
import { adoptWorkspace } from '../lib/adopt.js'

function fakeController({ created = true, id = 'ws-1', title = 'AIExperts', fail } = {}) {
  const calls = []
  return {
    calls,
    async create(request) {
      calls.push(request)
      if (fail) throw fail
      return { workspace: { workspaceId: id, title }, created }
    },
  }
}

test('把目录采纳成工作区，返回 id 与标题', async () => {
  const controller = fakeController()
  const out = await adoptWorkspace(controller, 'D:\\experts-demo')

  assert.equal(out.ok, true)
  assert.equal(out.created, true)
  assert.equal(out.id, 'ws-1')
  assert.equal(out.title, 'AIExperts')
  assert.deepEqual(controller.calls, [{ path: 'D:\\experts-demo' }])
})

test('已经是工作区时返回 created=false，但算成功', async () => {
  const out = await adoptWorkspace(fakeController({ created: false }), 'D:\\experts-demo')

  assert.equal(out.ok, true)
  assert.equal(out.created, false)
})

test('宿主没有工作区服务时给出原因，不抛错', async () => {
  assert.deepEqual(await adoptWorkspace(undefined, 'D:\\experts-demo'), { ok: false, reason: 'no-service' })
  assert.deepEqual(await adoptWorkspace({}, 'D:\\experts-demo'), { ok: false, reason: 'no-service' })
})

test('没有目录时直接拒绝', async () => {
  assert.deepEqual(await adoptWorkspace(fakeController(), ''), { ok: false, reason: 'no-directory' })
})

test('控制器报错时向上抛，交给调用方记日志', async () => {
  await assert.rejects(() => adoptWorkspace(fakeController({ fail: new Error('目录不存在') }), 'Z:\\nope'), /目录不存在/)
})

test('只返回 workspace（客户端形状）也能取到标题', async () => {
  const controller = { async create() { return { workspaceId: 'ws-9', title: '资料库' } } }
  const out = await adoptWorkspace(controller, 'E:\\资料库')

  assert.equal(out.ok, true)
  assert.equal(out.id, 'ws-9')
  assert.equal(out.title, '资料库')
})
