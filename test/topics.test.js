import test from 'node:test'
import assert from 'node:assert/strict'
import { tokenize, sameTopic, clusterQueries, topicsOf } from '../lib/topics.js'

test('分词：中文相邻两字，英文至少 3 个字符', () => {
  const tokens = tokenize('同行控件高度不一致 TextButton 最小高度')
  assert.ok(tokens.has('控件'))
  assert.ok(tokens.has('高度'))
  assert.ok(tokens.has('textbutton'))
  assert.ok(!tokens.has('textbutto'))
})

test('同一件事：共享至少两个词', () => {
  assert.equal(sameTopic(tokenize('同行控件高度不一致 布局位移'), tokenize('同行控件高度不一致导致布局位移')), true)
  assert.equal(sameTopic(tokenize('表格列宽与数字对齐'), tokenize('EADDRINUSE 端口占用 5173 报错原因')), false)
})

test('归并：同一主题合成一条，按次数降序', () => {
  const rows = clusterQueries([
    { query: '同行控件高度不一致 布局位移', ts: '2026-11-18T10:00:00Z' },
    { query: '同行控件高度不一致导致布局位移', ts: '2026-11-18T10:05:00Z' },
    { query: '表格列宽与数字对齐', ts: '2026-11-18T10:06:00Z' },
    { query: '同行控件高度不一致 布局位移 资料补充', ts: '2026-11-18T10:07:00Z' },
  ])
  assert.equal(rows.length, 2)
  assert.equal(rows[0].count, 3)
  assert.equal(rows[1].count, 1)
  assert.ok(rows[0].queries.length >= 3)
})

test('topicsOf：只算该专家、去重、带最近时间', () => {
  const trace = [
    { kind: 'miss', expert: 'a', query: '同行控件高度不一致 布局位移', ts: '2026-11-18T09:00:00Z' },
    { kind: 'miss', expert: 'a', query: '同行控件高度不一致 布局位移', ts: '2026-11-18T09:05:00Z' },
    { kind: 'miss', expert: 'b', query: '同行控件高度不一致 布局位移', ts: '2026-11-18T09:06:00Z' },
    { kind: 'ref_read', expert: 'a', query: 'x' },
  ]
  const rows = topicsOf(trace, 'a')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].count, 2)
  assert.equal(rows[0].lastTs, '2026-11-18T09:05:00Z')
})

test('不串成一团：相似但不同的事各自成条', () => {
  const rows = clusterQueries([
    { query: '商品列表 大规模条目 信息密度 筛选 二级入口 列表页设计', ts: '2026-11-18T10:00:00Z' },
    { query: '列表页两栏切换 顶部控件挤压 内容对齐 网格位置跳动', ts: '2026-11-18T10:01:00Z' },
    { query: '控件高度不一致导致布局位移 顶栏同行控件对齐', ts: '2026-11-18T10:02:00Z' },
  ])
  assert.equal(rows.length, 3)
})

test('自动判定：更对口就转交，已有相近主题就回收，其余才要授权去查', async () => {
  const { autoDecideFor } = await import('../lib/topics.js')
  const expert = { id: 'ui-design', topics: [{ title: '同行控件高度' }, { title: '配色与对比度' }] }
  const rows = [
    { expertId: 'ui-design', words: ['控件', '高度'] },
    { expertId: 'dsh-plugin', words: ['插件', '注册', '工具'] },
  ]
  const handoff = autoDecideFor({ title: '插件注册工具要几个文件' }, expert, rows, { expertId: 'dsh-plugin', word: '插件' })
  assert.equal(handoff.action, 'handoff')
  assert.equal(handoff.to, 'dsh-plugin')

  const recover = autoDecideFor({ title: '同行控件高度不一致' }, expert, rows, null)
  assert.equal(recover.action, 'recover')

  const research = autoDecideFor({ title: '包体积与首屏预算' }, expert, rows, null)
  assert.equal(research.action, 'research')
})

test('matchLibrary：已有资料会被认出来（按资料中文名与文件名）', async () => {
  const { matchLibrary } = await import('../lib/topics.js')
  const expert = {
    topics: [{ title: '视觉与尺寸' }],
    titles: { 'references/row-height-shift_20261117.md': '同行控件高度不一致' },
  }
  assert.equal(matchLibrary('控件高度不一致导致布局位移 顶栏同行控件对齐', expert), '同行控件高度不一致')
  assert.equal(matchLibrary('品牌字段 品牌重复 删掉品牌', expert), null)
  assert.equal(matchLibrary('视觉与尺寸', expert), '视觉与尺寸')
})


test('matchLibrary：名称对不上时，靠索引里的「一句话」也能认出来', async () => {
  const { matchLibrary } = await import('../lib/topics.js')
  const expert = {
    topics: [],
    titles: { 'references/a.md': '表格可读性' },
    summaries: { 'references/a.md': '列宽、对齐、数字右对齐，超过 8 列改换图或折叠' },
  }
  assert.equal(matchLibrary('表格 可读性 列宽 对齐 数字', expert), '表格可读性')
  assert.equal(matchLibrary('离线打包 版本号 更新公告', expert), null)
})

test('检索置信：低分判「可能没有」，前二分差小判「并列」', async () => {
  const { confidenceOf } = await import('../lib/retrieval.js')
  const low = confidenceOf([{ score: 0.42 }, { score: 0.31 }])
  assert.equal(low.lowConfidence, true)
  assert.equal(low.close, false)

  const tie = confidenceOf([{ score: 0.612 }, { score: 0.607 }])
  assert.equal(tie.lowConfidence, false)
  assert.equal(tie.close, true)

  const clear = confidenceOf([{ score: 0.7 }, { score: 0.52 }])
  assert.equal(clear.lowConfidence, false)
  assert.equal(clear.close, false)

  const empty = confidenceOf([])
  assert.equal(empty.lowConfidence, true)
})
