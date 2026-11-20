import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  categoryIndexOf,
  textOfAssistant,
  appendSessionLog,
  readSessionLog,
  watchCategorySessions,
} from '../lib/session-log.js'

test('只认这 8 个大类会话的 id', () => {
  assert.equal(categoryIndexOf('session-expert-cat-01'), 1)
  assert.equal(categoryIndexOf('session-expert-cat-08'), 8)
  assert.equal(categoryIndexOf('session-expert-cat-09'), 0)
  assert.equal(categoryIndexOf('session-expert-task-abc'), 0)
  assert.equal(categoryIndexOf(''), 0)
})

test('取助手正文：只要 text 块', () => {
  const text = textOfAssistant({
    message: { content: [{ type: 'text', text: '我负责终端与场景。' }, { type: 'tool-call' }] },
  })
  assert.equal(text, '我负责终端与场景。')
  assert.equal(textOfAssistant({ message: { content: [] } }), '')
})

test('写一条再读回来，最新在前', async () => {
  const root = await mkdtemp(join(tmpdir(), 'slog-'))
  await appendSessionLog(root, { session: 'session-expert-cat-06', cat: 6, chars: 5, tools: 2, text: '第一轮' })
  await appendSessionLog(root, { session: 'session-expert-cat-03', cat: 3, chars: 3, tools: 0, text: '第二轮' })
  const entries = await readSessionLog(root, { limit: 10 })
  assert.equal(entries.length, 2)
  assert.equal(entries[0].cat, 3)
  assert.equal(entries[1].cat, 6)
  assert.equal(entries[1].tools, 2)
  assert.ok(entries[0].ts)
})

test('一轮结束才落一条，且只收这 8 个会话', async () => {
  const root = await mkdtemp(join(tmpdir(), 'slog-'))
  const handlers = {}
  const ctx = {
    on(name, fn) {
      handlers[name] = fn
      return () => {
        delete handlers[name]
      }
    },
  }
  watchCategorySessions(ctx, { root })

  handlers['session/event']({ header: { id: 'session-expert-cat-02' } }, {
    type: 'assistant/message',
    data: { message: { content: [{ type: 'text', text: '工程与交付这一轮查了两份资料。' }] } },
  })
  handlers['session/event']({ header: { id: 'session-expert-cat-02' } }, { type: 'tool/call', data: {} })
  // 别的会话不该被收
  handlers['session/event']({ header: { id: 'session-other' } }, {
    type: 'assistant/message',
    data: { message: { content: [{ type: 'text', text: '不该出现' }] } },
  })
  handlers['agent/turn-stopping']({ agent: { id: 'session-expert-cat-02' } })

  // 落盘是异步的，等一拍
  await new Promise((resolve) => setTimeout(resolve, 50))
  const entries = await readSessionLog(root, { limit: 10 })
  assert.equal(entries.length, 1)
  assert.equal(entries[0].cat, 2)
  assert.equal(entries[0].tools, 1)
  assert.match(entries[0].text, /工程与交付/)
  const raw = await readFile(join(root, '.trace', 'session-log.jsonl'), 'utf8')
  assert.ok(!raw.includes('不该出现'))
})

test('只有工具、没有说话的一轮不落空记录', async () => {
  const root = await mkdtemp(join(tmpdir(), 'slog-'))
  const handlers = {}
  watchCategorySessions(
    { on: (name, fn) => { handlers[name] = fn; return () => {} } },
    { root },
  )
  handlers['session/event']({ header: { id: 'session-expert-cat-05' } }, { type: 'tool/call', data: {} })
  handlers['agent/turn-stopping']({ agent: { id: 'session-expert-cat-05' } })
  await new Promise((resolve) => setTimeout(resolve, 30))
  assert.equal((await readSessionLog(root, { limit: 10 })).length, 0)
})

import { zstdCompressSync } from 'node:zlib'
import { mkdir, writeFile } from 'node:fs/promises'
import { decodeZstdFrames, turnsFromEvents, backfillSessionLog } from '../lib/session-log.js'

test('多帧 zstd 能拼回完整事件流', () => {
  const a = zstdCompressSync(Buffer.from('{"type":"turn/start","time":1}\n', 'utf8'))
  const b = zstdCompressSync(Buffer.from('{"type":"turn/end","time":2}\n', 'utf8'))
  const text = decodeZstdFrames(Buffer.concat([a, b]))
  assert.equal(text.trim().split('\n').length, 2)
  assert.match(text, /turn\/end/)
})

test('从事件流切出一轮：正文与工具次数、时间', () => {
  const turns = turnsFromEvents([
    { type: 'turn/start', time: 1000 },
    { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: '我先查资料。' }] } } },
    { type: 'tool/call' },
    { type: 'tool/call' },
    { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: '查完了。' }] } } },
    { type: 'turn/end', time: 5000 },
  ])
  assert.equal(turns.length, 1)
  assert.equal(turns[0].tools, 2)
  assert.match(turns[0].text, /查完了/)
  assert.equal(turns[0].ts, new Date(5000).toISOString())
})

test('回填：写进历史、重复跑不重复写', async () => {
  const home = await mkdtemp(join(tmpdir(), 'dshhome-'))
  const root = await mkdtemp(join(tmpdir(), 'lib-'))
  const sessionId = 'session-expert-cat-06'
  const dir = join(home, 'sessions', '--E-000Dev-AIExperts--', sessionId)
  await mkdir(dir, { recursive: true })
  const lines = [
    { type: 'turn/start', time: 1000 },
    { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: '我负责终端与场景。' }] } } },
    { type: 'tool/call' },
    { type: 'turn/end', time: 2000 },
  ].map((event) => `${JSON.stringify(event)}\n`).join('')
  await writeFile(join(dir, 'session.v4.jsonl.zstd'), zstdCompressSync(Buffer.from(lines, 'utf8')))

  const first = await backfillSessionLog(home, root, { sessionIds: [sessionId] })
  assert.equal(first.added, 1)
  const entries = await readSessionLog(root, { limit: 10 })
  assert.equal(entries.length, 1)
  assert.equal(entries[0].cat, 6)
  assert.equal(entries[0].tools, 1)
  assert.equal(entries[0].backfilled, true)

  const second = await backfillSessionLog(home, root, { sessionIds: [sessionId] })
  assert.equal(second.added, 0)
  assert.equal((await readSessionLog(root, { limit: 10 })).length, 1)
})

import { judgeNeeds } from '../lib/session-log.js'

test('判定：认固定标记', () => {
  assert.deepEqual(judgeNeeds('干完了。\n【不用你看】'), { need: false, kind: '', reason: '' })
  const spend = judgeNeeds('干完了。\n【要你看·花额度】要不要我去补两份资料')
  assert.equal(spend.need, true)
  assert.equal(spend.kind, 'spend')
  assert.match(spend.reason, /补两份资料/)
  assert.equal(judgeNeeds('【要你看·改别类】这份该挪到 03 类').kind, 'cross')
  assert.equal(judgeNeeds('【要你看·新建专家】这一块一直没人').kind, 'new-expert')
})

test('判定：没写标记时用保守关键词兜底', () => {
  assert.equal(judgeNeeds('要不要我去查一下？').kind, 'spend')
  assert.equal(judgeNeeds('这份资料该改别的专家的库').kind, 'cross')
  assert.equal(judgeNeeds('建议新建一个专家').kind, 'new-expert')
  assert.equal(judgeNeeds('今天这类没有新问题。').need, false)
})
