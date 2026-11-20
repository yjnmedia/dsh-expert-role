import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeSource, sourcesOf, renderSources, SOURCE_LEVELS } from '../lib/sources.js'

test('五级定义齐全', () => {
  assert.deepEqual(SOURCE_LEVELS, ['S', 'A', 'B', 'C', 'D'])
})

test('非法级别与空路径被过滤', () => {
  assert.equal(normalizeSource(null), null)
  assert.equal(normalizeSource({ path: '' }), null)
  assert.equal(normalizeSource({ path: 'C:/x.py', level: 'X' }), null)
  assert.deepEqual(normalizeSource({ path: 'C:/x.py', level: 's', lines: '12' }), {
    path: 'C:/x.py', level: 'S', use: '', lines: 12, verifiedAt: '', note: '',
  })
})

test('按级别排序：S 在前，D 在后', () => {
  const rows = sourcesOf({
    sources: [
      { path: 'b.py', level: 'B' },
      { path: 's.py', level: 'S' },
      { path: 'd.py', level: 'D' },
      { path: 'a.py', level: 'A' },
    ],
  })
  assert.deepEqual(rows.map((row) => row.level), ['S', 'A', 'B', 'D'])
})

test('渲染成表格，空列表返回空串', () => {
  assert.equal(renderSources([]), '')
  const text = renderSources([{ path: 'C:/x.py', level: 'S', use: '骨架', lines: 10, verifiedAt: '2026-11-18' }])
  assert.match(text, /\| S \| `C:\/x\.py` \| 骨架 \| 10 \| 2026-11-18 \|/)
})
