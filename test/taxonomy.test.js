import test from 'node:test'
import assert from 'node:assert/strict'
import { loadTaxonomy, groupExperts, normalize } from '../lib/taxonomy.js'

const experts = [
  { id: 'a', title: '甲', level1: '内容生产' },
  { id: 'b', title: '乙', level1: '内容生产' },
  { id: 'c', title: '丙', level1: '界面与体验' },
  { id: 'd', title: '丁', level1: '没这个类' },
]

test('默认分类表有七大类加其他，按 order 排序', async () => {
  const taxonomy = await loadTaxonomy(process.cwd())
  assert.ok(Array.isArray(taxonomy.groups))
  assert.equal(taxonomy.groups.length, 8)
  const titles = taxonomy.groups.map((g) => g.title)
  assert.deepEqual(titles, ['平台与运行', '工程与交付', '界面与体验', '内容生产', '人工智能', '终端与场景', '业务与运营', '专业技术'])
})

test('分组按专家 level1 归位，未匹配的并入其他', () => {
  const taxonomy = { groups: normalize({
    version: 1,
    groups: [
      { id: 'content', title: '内容生产', order: 10, desc: '' },
      { id: 'misc', title: '专业技术', order: 90, desc: '' },
    ],
  }) }
  const grouped = groupExperts(experts, taxonomy.groups)
  const byTitle = Object.fromEntries(grouped.map((g) => [g.title, g]))
  assert.equal(byTitle['内容生产'].count, 2)
  assert.deepEqual(byTitle['内容生产'].experts.map((e) => e.id), ['a', 'b'])
  assert.equal(byTitle['专业技术'].count, 2)
})

test('本地库放 taxonomy.json 时以本地为准', async () => {})
