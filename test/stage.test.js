import assert from 'node:assert/strict'
import test from 'node:test'

import { STAGES, stageInfoOf, stageOf } from '../lib/library.js'
import { tierOf, weakestOf, DIM_NAMES } from '../lib/maturity.js'

test('阶段只有四档，档名不再含数量词', () => {
  assert.deepEqual([...STAGES], ['起步', '可用', '可靠', '权威', '标杆'])
})

test('有成熟度结果时直接用它的档位与星级', () => {
  const expert = { maturity: { tier: '可靠', level: 3, hint: '总分 72，卡在调研闭环' } }
  const info = stageInfoOf(expert)
  assert.equal(info.level, '可靠')
  assert.equal(info.stars, '★★★☆☆')
  assert.equal(info.index, 3)
  assert.equal(info.hint, '总分 72，卡在调研闭环')
  assert.equal(stageOf(expert), '可靠')
})

test('没有成熟度结果时按起步兜底，不假装有分数', () => {
  const info = stageInfoOf({ topics: [] })
  assert.equal(info.level, '起步')
  assert.equal(info.stars, '★☆☆☆☆')
})

test('总分够但短板维度不达标，不能进阶', () => {
  const good = { D1: 0.95, D2: 0.9, D3: 0.8, D4: 0.9, D5: 0.8, D6: 0.8 }
  assert.equal(tierOf(88, good), 3)
  assert.equal(tierOf(88, { ...good, D5: 0.4 }), 3)  // 使用维不压档
  assert.equal(tierOf(88, { ...good, D2: 0.5 }), 1)  // 覆盖不够，只能到可用
  assert.equal(tierOf(88, { ...good, D1: 0.6 }), 0)  // 结构崩了，连可用都不算
  assert.equal(tierOf(72, { ...good, D6: 0.1 }), 2)
  assert.equal(tierOf(57, good), 0)
  assert.equal(tierOf(65, { ...good, D2: 0.3 }), 0)
})

test('短板取最低的一维，全都高时返回空', () => {
  const weak = weakestOf({ D1: 0.9, D2: 0.8, D3: 0.7, D4: 0.9, D5: 0.5, D6: 0.2 })
  assert.equal(weak.key, 'D6')
  assert.equal(weak.name, DIM_NAMES.D6)
  assert.equal(weakestOf({ D1: 0.9, D2: 0.9, D3: 0.9, D4: 0.9, D5: 0.9, D6: 0.9 }), undefined)
})
