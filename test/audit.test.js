import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { classifyRetrieval, summarizeRetrieval, recordRetrievalFailure, readRetrieval } from '../lib/audit.js'

const top = (expert, score) => ({ expert, title: expert, rel: 'x', score })

test('自检标记：空、低分、并列、跨专家', () => {
  assert.deepEqual(classifyRetrieval({ top: [] }), ['empty'])
  assert.deepEqual(classifyRetrieval({ top: [top('reader', 0.42), top('reader', 0.2)] }), ['low'])
  assert.deepEqual(classifyRetrieval({ top: [top('reader', 0.7), top('reader', 0.695)] }), ['close'])
  assert.deepEqual(classifyRetrieval({ top: [top('reader', 0.7), top('ui-design', 0.68)] }), ['cross'])
  assert.deepEqual(classifyRetrieval({ top: [top('reader', 0.7), top('reader', 0.4)] }), [])
})

test('自检汇总：只数窗口内、按原因分类', () => {
  const now = Date.now()
  const rows = [
    { ts: new Date(now - 1000).toISOString(), reasons: ['low'] },
    { ts: new Date(now - 2000).toISOString(), reasons: ['close', 'cross'] },
    { ts: new Date(now - 3000).toISOString(), reasons: [] },
    { ts: new Date(now - 40 * 24 * 3600 * 1000).toISOString(), reasons: ['low'] },
  ]
  const summary = summarizeRetrieval(rows, { days: 7, now })
  assert.equal(summary.total, 3)
  assert.equal(summary.risky, 2)
  assert.equal(summary.byReason.low, 1)
  assert.equal(summary.byReason.close, 1)
  assert.equal(summary.byReason.cross, 1)
  assert.equal(summary.byReason.empty, 0)
})

test('检索失败也留痕：落 retrieve-failed 并计为 fallback', async () => {
  const root = await mkdtemp(join(tmpdir(), 'audit-fail-'))
  try {
    const entry = await recordRetrievalFailure(root, {
      query: '平方反比 柔光布距离',
      expert: 'video-shooting',
      error: 'Cannot find package onnxruntime-node',
    })
    assert.equal(entry.kind, 'retrieve-failed')
    assert.deepEqual(entry.reasons, ['fallback'])
    assert.match(entry.error, /onnxruntime/)
    const rows = await readRetrieval(root, 10)
    assert.equal(rows.length, 1)
    const summary = summarizeRetrieval(rows, { days: 7 })
    assert.equal(summary.byReason.fallback, 1)
    assert.equal(summary.risky, 1)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
