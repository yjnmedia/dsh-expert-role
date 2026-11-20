import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  busySessionIds,
  categorySessionId,
  isCategorySession,
  runIdentity,
  researchPrompt,
  slugOf,
  readRuns,
  markRunStarted,
  markRunEnded,
  runsToMap,
  elapsedMs,
} from '../lib/research.js'

test('调研只投进八个大类会话，不新建会话号', () => {
  assert.equal(categorySessionId(3), 'session-expert-cat-03')
  assert.equal(categorySessionId(8), 'session-expert-cat-08')
  assert.equal(categorySessionId(0), '')
  assert.equal(categorySessionId(9), '')
  assert.ok(isCategorySession('session-expert-cat-01'))
  assert.ok(!isCategorySession('session-expert-gap-ui-design-12345678'))
  assert.equal(runIdentity('ui-design', '同行控件高度'), 'ui-design\u0000同行控件高度')
})

test('slug 去掉标点空格，留中文', () => {
  assert.equal(slugOf('同行控件高度不一致 布局位移，怎么统一'), '同行控件高度不一致-布局位移怎么统一')
  assert.equal(slugOf('   '), 'note')
  assert.ok(slugOf('a'.repeat(200)).length <= 60)
})

test('提示词把路径、步骤、三段式都写进去', () => {
  const text = researchPrompt({ expertId: 'reader', expertDir: 'E:/x/reader', topic: '14px 正文行高', key: '行高怎么定' })
  for (const must of ['lookup_expert_knowledge', 'E:/x/reader', 'references\\index.md', 'manifest.json', 'expertctl.mjs doctor', '结论', '【不用你看】']) {
    assert.ok(text.includes(must), '提示词缺：' + must)
  }
})

test('跑完一轮能落一条记录，再跑同一件事覆盖不重复', async () => {
  const root = mkdtempSync(join(tmpdir(), 'expert-research-'))
  const sessionId = categorySessionId(6)
  await markRunStarted(root, { sessionId, expert: 'reader', key: '行高', topic: '行高', startedAt: new Date().toISOString() })
  let runs = await readRuns(root)
  assert.equal(runs.length, 1)
  assert.equal(runs[0].status, 'running')

  await markRunStarted(root, { sessionId, expert: 'reader', key: '行高', topic: '行高', startedAt: new Date().toISOString() })
  assert.equal((await readRuns(root)).length, 1)

  await markRunEnded(root, { sessionId, expert: 'reader', key: '行高', status: 'done', files: ['references/x.md'] })
  runs = await readRuns(root)
  assert.equal(runs[0].status, 'done')
  assert.deepEqual(runs[0].files, ['references/x.md'])
  assert.ok(runs[0].endedAt)

  const map = runsToMap(runs)
  assert.equal(map.get('reader\u0000行高')?.status, 'done')
  assert.ok(elapsedMs(runs[0]) >= 0)
})

test('没开始就结束也能补一条，状态不悬着', async () => {
  const root = mkdtempSync(join(tmpdir(), 'expert-research-end-'))
  const sessionId = categorySessionId(6)
  await markRunEnded(root, { sessionId, status: 'failed', error: '额度用完' })
  const runs = await readRuns(root)
  assert.equal(runs.length, 1)
  assert.equal(runs[0].status, 'failed')
  assert.equal(runs[0].error, '额度用完')
})

// ---- 卡住检测：先看结构，时间只兜底 ----
import { diagnoseRun } from '../lib/research.js'

const call = (id, name, args, time) => ({ type: 'tool/call', time, data: { callId: id, name, arguments: args } })
const result = (id, time, error) => ({ type: 'tool/result', time, data: { toolCallId: id, error } })
const said = (text, time) => ({ type: 'assistant/message', time, data: { content: [{ type: 'text', text }] } })

test('没人在跑：直接判孤儿，不看时间', () => {
  const d = diagnoseRun([said('在干活', Date.now())], { live: false })
  assert.equal(d.code, 'orphaned')
})

test('在等你回话：认标记', () => {
  const d = diagnoseRun([said('结论：查完了。\n待办：【要你看·花额度】要不要补两份', Date.now())], { now: Date.now() })
  assert.equal(d.code, 'needs-you')
})

test('工具没返回超过 90 秒算卡住', () => {
  const now = Date.now()
  const d = diagnoseRun([call('c1', 'ops_bash', '{"command":"adb screencap"}', now - 200000)], { now })
  assert.equal(d.code, 'stuck-tool')
  assert.equal(d.detail, 'ops_bash')
})

test('刚调出去还没回：不算卡住', () => {
  const now = Date.now()
  const d = diagnoseRun([call('c1', 'ops_bash', '{}', now - 5000)], { now })
  assert.equal(d.code, 'running')
})

test('同一工具同一参数连调 3 次判原地打转', () => {
  const now = Date.now()
  const events = []
  for (let i = 0; i < 3; i += 1) {
    events.push(call('c' + i, 'ops_bash', '{"command":"adb shell input tap 1 1"}', now - (40 - i) * 1000))
    events.push(result('c' + i, now - (40 - i) * 1000 + 500))
  }
  assert.equal(diagnoseRun(events, { now }).code, 'looping')
})

test('连续 5 次工具报错判环境不对', () => {
  const now = Date.now()
  const events = []
  for (let i = 0; i < 5; i += 1) {
    events.push(call('e' + i, 'ops_bash', '{"command":"x' + i + '"}', now - (30 - i) * 1000))
    events.push(result('e' + i, now - (30 - i) * 1000 + 300, 'command not found'))
  }
  assert.equal(diagnoseRun(events, { now }).code, 'failing')
})

test('什么都没发生超过 10 分钟才用时间兜底', () => {
  const now = Date.now()
  assert.equal(diagnoseRun([said('先看看', now - 11 * 60 * 1000)], { now }).code, 'idle')
  assert.equal(diagnoseRun([said('先看看', now - 60 * 1000)], { now }).code, 'running')
})

import { turnFinished, finishedAt } from '../lib/research.js'

test('回合真结束了才自愈，没结束不算', () => {
  const now = Date.now()
  assert.equal(turnFinished([{ type: 'turn/start', time: now }, { type: 'turn/end', time: now + 5 }]), true)
  assert.equal(turnFinished([{ type: 'turn/start', time: now }, { type: 'tool/call', time: now + 5 }]), false)
  assert.equal(turnFinished([]), false)
  assert.equal(finishedAt([{ type: 'turn/end', time: 1795152381447 }]), new Date(1795152381447).toISOString())
})


test('busySessionIds 只捞正在跑的会话，去重', () => {
  const ids = busySessionIds([
    { sessionId: 'session-expert-cat-03', status: 'running' },
    { sessionId: 'session-expert-cat-03', status: 'done' },
    { sessionId: 'session-expert-cat-06', status: 'running' },
    { sessionId: '', status: 'running' },
  ])
  assert.deepEqual([...ids].sort(), ['session-expert-cat-03', 'session-expert-cat-06'])
  assert.equal(busySessionIds(null).size, 0)
})
