#!/usr/bin/env node
/**
 * 双名方案的第 0 步：先量基线。
 *
 * 25 道题 = 5 位专家 × 5 题（每专家 3 题来自它自己的 index，2 题是「像它但其实不归它」的干扰项）。
 * 打分口径：把题面丢给 matchLibrary（标题+摘要+文件名，名称加权）与 keywordHit（提醒用词表），
 * 看它认出的专家是否等于出题专家。命中记 1，否则 0。
 *
 * 用法：node scripts/query-baseline.mjs [--root E:/000Dev/AIExperts]
 */

import { join } from 'node:path'
import { ExpertLibrary } from '../lib/library.js'
import { scoreLibrary, rankExperts } from '../lib/topics.js'
import { keywordHit, rowsOf } from '../lib/trigger.js'

const rootArg = process.argv.indexOf('--root')
const root = rootArg >= 0 ? process.argv[rootArg + 1] : process.env.DSH_EXPERT_ROOT ?? 'E:/000Dev/AIExperts'

// 每题：{q: 问法, want: 期望专家 id}
const QUESTIONS = [
  { q: '动漫少女的正面提示词，负面词给几条', want: 'ai-image' },
  { q: '换参考图以后角色脸还是不像，怎么调一致性和参考图强度', want: 'ai-image' },
  { q: '要挂 LoRA，底模用 GGUF 还是 safetensors', want: 'ai-image' },
  { q: '出图任务排队卡住很久，重试间隔怎么定', want: 'ai-image' },
  { q: '定妆图批量生成时，用户给的意见怎么并进提示词', want: 'ai-image' },

  { q: '3 万字小说改 12 集短剧，怎么分集和卡点', want: 'ai-drama' },
  { q: '短剧的伏笔该在第几集回收', want: 'ai-drama' },
  { q: '小说改成短剧时人物线太多怎么合并', want: 'ai-drama' },
  { q: '短剧开头三分钟要交代哪些信息', want: 'ai-drama' },
  { q: '短剧改编要不要保留原著的叙述顺序', want: 'ai-drama' },

  { q: '阅读器正文 14px，行高和每行字数定多少', want: 'reader' },
  { q: '书源加载失败要不要自动切换下一个源', want: 'reader' },
  { q: '阅读器翻页动画卡顿，分页怎么做才不卡', want: 'reader' },
  { q: '长按选中一段文字，做背景名词解释怎么触发', want: 'reader' },
  { q: '阅读器要不要做跨设备同步阅读进度', want: 'reader' },

  { q: 'DSH 插件注册一个自定义工具要几个文件', want: 'dsh-plugin' },
  { q: '插件把 dsh 弄崩了，安全模式清空 bundles 之后怎么恢复', want: 'dsh-plugin' },
  { q: '怎么给技能包加 references 又不让正文超长', want: 'dsh-plugin' },
  { q: 'SSH 隧道总断，保活参数怎么设', want: 'dsh-plugin' },
  { q: '插件面板里怎么加图表、什么时候用环形图', want: 'ui-design' },

  { q: '桌面面板一屏放几块、块标题字号多大', want: 'ui-design' },
  { q: '设置页选项太多，怎么分组才不晕', want: 'ui-interaction' },
  { q: '列表行高和卡片内边距按什么比例配', want: 'ui-design' },
  { q: '自定义下拉框要做键盘操作和无障碍', want: 'ui-interaction' },
  { q: '面板上的操作按钮该放标题旁边还是最右边', want: 'ui-interaction' },
]


// 未参与调参的验收集：写在这里之前，上面 25 题一直是唯一被看过的集合。
const HELD_OUT = [
  { q: '生成的人像手指畸形，提示词里该怎么描述手脚', want: 'ai-image' },
  { q: '同一张脸换三套衣服，身份保持一致要哪些手段', want: 'ai-image' },
  { q: '小说里三条副线，短剧只保留两条怎么选', want: 'ai-drama' },
  { q: '短剧一集结尾留钩子怎么写', want: 'ai-drama' },
  { q: '阅读器里 AI 摘要太长，怎么控制长度', want: 'reader' },
  { q: '阅读进度在多台设备之间怎么同步', want: 'reader' },
  { q: '插件要怎么在设置页加一个自己的区块', want: 'dsh-plugin' },
  { q: '我的插件升级后用户配置会被覆盖吗', want: 'dsh-plugin' },
  { q: '面板里卡片和分隔线能不能同时用', want: 'ui-design' },
  { q: '列表太长要不要分页还是滚动加载', want: 'reader' },
  { q: '深色主题下正文对比度要求多少', want: 'ui-design' },
  { q: '表格列很多时怎么保证可读', want: 'ui-design' },
]

const library = new ExpertLibrary(root)
const rows = await rowsOf(library)
const ids = await library.listExpertIds()
const experts = []
for (const id of ids) {
  const expert = await library.readExpert(id).catch(() => null)
  if (expert) experts.push(expert)
}

let routeHits = 0
let titleHits = 0
let hintHits = 0
const rowsOut = []
const heldRows = []
let heldHits = 0
for (const item of HELD_OUT) {
  const routed = rankExperts(item.q, experts)
  const ok = routed?.expertId === item.want
  if (ok) heldHits += 1
  heldRows.push({ q: item.q, want: item.want, routed: routed ? `${routed.expertId}(${routed.score.toFixed(1)})` : '—', ok: ok ? 'Y' : 'N' })
}

for (const item of QUESTIONS) {
  const byTitle = experts
    .map((expert) => ({ id: expert.id, score: scoreLibrary(item.q, expert)?.score ?? 0 }))
    .sort((a, b) => b.score - a.score)[0]
  const byHint = keywordHit(item.q, rows)
  const routed = rankExperts(item.q, experts)
  const routeOk = routed?.expertId === item.want
  if (routeOk) routeHits += 1
  const titleOk = byTitle?.id === item.want && (byTitle.score ?? 0) > 0
  const hintOk = byHint?.expertId === item.want
  if (titleOk) titleHits += 1
  if (hintOk) hintHits += 1
  rowsOut.push({
    q: item.q,
    want: item.want,
    routed: routed ? `${routed.expertId}(${routed.score.toFixed(1)})` : '—',
    title: `${byTitle?.id ?? '—'}${byTitle?.score ? '(' + byTitle.score.toFixed(1) + ')' : ''}`,
    hint: byHint?.expertId ?? '—',
    ok: routeOk ? 'Y' : titleOk ? 'T' : hintOk ? '~' : 'N',
  })
}

const total = QUESTIONS.length
console.log(`题目 ${total} 道；库里有 ${experts.length} 位专家`)
console.log(`路由判定（rankExperts）命中：${routeHits}/${total}（${Math.round((routeHits / total) * 100)}%）`)
console.log(`标题+摘要判定 top1 命中：${titleHits}/${total}（${Math.round((titleHits / total) * 100)}%）`)
console.log(`提醒关键词判定命中：${hintHits}/${total}（${Math.round((hintHits / total) * 100)}%）`)
console.log('')
console.log('| # | 问法 | 期望 | 路由 | 标题判定 | 关键词 | 结果 |')
console.log('|---|---|---|---|---|---|---|')
rowsOut.forEach((row, i) => {
  console.log(`| ${i + 1} | ${row.q} | ${row.want} | ${row.routed} | ${row.title} | ${row.hint} | ${row.ok} |`)
})


// 验收集单独统计，不和调参集混在一起。
if (heldRows.length) {
  console.log('')
  console.log(`验收集（未参与调参）：${heldHits}/${heldRows.length}（${Math.round((heldHits / heldRows.length) * 100)}%）`)
  console.log('| # | 问法 | 期望 | 路由 | 结果 |')
  console.log('|---|---|---|---|---|')
  heldRows.forEach((row, i) => {
    console.log(`| ${i + 1} | ${row.q} | ${row.want} | ${row.routed} | ${row.ok} |`)
  })
}

if (process.env.JSON_OUT) {
  const { writeFileSync } = await import('node:fs')
  writeFileSync(process.env.JSON_OUT, JSON.stringify({ total, routeHits, titleHits, hintHits, rows: rowsOut }, null, 2))
}
