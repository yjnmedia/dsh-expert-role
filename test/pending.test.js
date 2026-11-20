import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { addPending, listPending, finishPending } from '../lib/pending.js'

async function withRoot(fn) {
  const root = await mkdtemp(join(tmpdir(), 'pending-'))
  try {
    return await fn(root)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

test('排队、去重、完成', async () => {
  await withRoot(async (root) => {
    await addPending(root, { expert: 'ui-design', key: '控件高度', action: 'recover', title: '控件高度' })
    await addPending(root, { expert: 'ui-design', key: '控件高度', action: 'recover', title: '控件高度' })
    let rows = await listPending(root, 'queued')
    assert.equal(rows.length, 1)
    assert.equal(rows[0].id, 'ui-design|控件高度|recover')

    const done = await finishPending(root, rows[0].id)
    assert.equal(done.ok, true)
    rows = await listPending(root, 'queued')
    assert.equal(rows.length, 0)
    assert.equal((await listPending(root)).length, 1)
  })
})

test('完成不存在的待办返回错误而不是抛错', async () => {
  await withRoot(async (root) => {
    const result = await finishPending(root, 'nope')
    assert.equal(result.ok, false)
    assert.match(result.error, /没有这条待办/)
  })
})
