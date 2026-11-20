import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ExpertLibrary } from '../lib/library.js'
import { registerTraceHooks, sessionUuidOf } from '../lib/trace.js'

async function tempLibrary(t) {
  const base = join(process.cwd(), '.tmp')
  await mkdir(base, { recursive: true })
  const root = await mkdtemp(join(base, 'trace-test-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const library = new ExpertLibrary(root)
  await library.ensureRoot()
  await mkdir(join(root, 'demo', 'references'), { recursive: true })
  await writeFile(join(root, 'demo', 'references', 'index.md'), '| 资料 | 路径 | 说明 |\n', 'utf8')
  return library
}

function fakeCtx() {
  const handlers = new Map()
  return {
    handlers,
    effect(fn) {
      return fn()
    },
    on(event, fn) {
      handlers.set(event, fn)
      return () => handlers.delete(event)
    },
  }
}

const uuid = '12345678-1234-1234-1234-123456789abc'

test('sessionUuidOf 把带前缀的会话归一成 uuid', () => {
  assert.equal(sessionUuidOf(`session-expert-task-${uuid}`), uuid)
  assert.equal(sessionUuidOf(uuid.toUpperCase()), uuid)
  assert.equal(sessionUuidOf('unknown'), '')
})

test('命令行读专家库也记一条 ref_read，并带归一后的会话 id', async (t) => {
  const library = await tempLibrary(t)
  const ctx = fakeCtx()
  registerTraceHooks(ctx, library)
  const handler = ctx.handlers.get('tools/post-execute')
  assert.equal(typeof handler, 'function')

  await handler(
    {
      name: 'ops_bash',
      arguments: { command: `cat "${library.root}/demo/references/index.md"` },
      agent: { session: { id: `session-expert-task-${uuid}` } },
      durationMs: 3,
    },
    '一行内容',
    async () => ({}),
  )

  const tail = await library.traceTail(10)
  const entry = tail.find((item) => item.kind === 'ref_read')
  assert.ok(entry, '应当记一条 ref_read')
  assert.equal(entry.expert, 'demo')
  assert.equal(entry.sessionUuid, uuid)
})

test('写命令与无关命令不记 ref_read', async (t) => {
  const library = await tempLibrary(t)
  const ctx = fakeCtx()
  registerTraceHooks(ctx, library)
  const handler = ctx.handlers.get('tools/post-execute')

  await handler(
    { name: 'ops_bash', arguments: { command: `rm -rf "${library.root}/demo/references"` }, agent: { session: { id: uuid } } },
    'ok',
    async () => ({}),
  )
  await handler(
    { name: 'ops_bash', arguments: { command: 'echo hello' }, agent: { session: { id: uuid } } },
    'hello',
    async () => ({}),
  )

  const tail = await library.traceTail(10)
  assert.equal(tail.filter((item) => item.kind === 'ref_read').length, 0)
})
