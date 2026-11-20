import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gapOf, runtimeMisses, gapNoticeText, percentOf } from '../lib/gap.js'
import { DEFAULT_GAP, GAP_OPTIONS, readSettings, writeSettings } from '../lib/settings.js'
import { mkdtemp, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('缺口 = 自测与运行时查空一起算', () => {
  const expert = { id: 'x', title: 'X 专家', maturity: { queries: { total: 10, hit: 7 } } }
  const trace = [
    { kind: 'miss', expert: 'x' },
    { kind: 'miss', expert: 'x' },
    { kind: 'miss', expert: 'y' },
    { kind: 'ref_read', expert: 'x' },
  ]
  assert.equal(runtimeMisses(trace, 'x'), 2)
  const info = gapOf(expert, trace)
  assert.equal(info.misses, 2)
  assert.equal(info.total, 12)
  assert.equal(info.hit, 7)
  assert.ok(Math.abs(info.gap - 5 / 12) < 1e-9)
})

test('没有任何信号时缺口为 0，不算已知', () => {
  const info = gapOf({ id: 'x' }, [])
  assert.equal(info.known, false)
  assert.equal(info.gap, 0)
})

test('提示文案说清缺口、来源与怎么补', () => {
  const text = gapNoticeText('x', { title: 'X 专家' }, { gap: 0.4, total: 10, hit: 6, misses: 0 }, 0.2)
  assert.match(text, /X 专家/)
  assert.match(text, /40%/)
  assert.match(text, /自测 10 题里命中 6 题/)
  assert.match(text, /面板首页「需要补的资料」/)
  assert.match(text, /说「补」/) 
  assert.equal(percentOf(0.333), '33%')
})

test('设置里 gap 默认 20%，非法值被拒', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gap-settings-'))
  const settings = await readSettings(root)
  assert.equal(settings.gap, DEFAULT_GAP)
  assert.deepEqual(GAP_OPTIONS, [0.1, 0.2, 0.3, 0.5])
  const next = await writeSettings(root, { gap: 0.3 })
  assert.equal(next.gap, 0.3)
  assert.equal((await readSettings(root)).gap, 0.3)
  await assert.rejects(() => writeSettings(root, { gap: 0.7 }))
})

test('panel 缺口清单：只列真有过缺口，带最近没查到的提问', async () => {
  const { gapRows, missQueriesOf } = await import('../lib/gap.js')
  const trace = [
    { kind: 'miss', expert: 'a', query: '控件高度不一致' },
    { kind: 'miss', expert: 'a', query: '控件高度不一致' },
    { kind: 'miss', expert: 'a', query: '空状态怎么写' },
    { kind: 'miss', expert: 'b', query: '别的专家的问题' },
  ]
  assert.deepEqual(missQueriesOf(trace, 'a'), ['空状态怎么写', '控件高度不一致'])
  const rows = gapRows(
    [
      { id: 'a', title: 'A 专家', gap: { gap: 0.25, misses: 3, hit: 3, total: 4 } },
      { id: 'b', title: 'B 专家', gap: { gap: 0, misses: 0, hit: 3, total: 3 } },
    ],
    trace,
    0.2,
  )
  assert.equal(rows.length, 1)
  assert.equal(rows[0].id, 'a')
  assert.equal(rows[0].overThreshold, true)
  assert.deepEqual(rows[0].examples, ['空状态怎么写', '控件高度不一致'])
})
