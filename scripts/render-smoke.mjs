// 客户端渲染冒烟：用假 React 真的把面板和各标签页渲染一遍，组件里任何异常都会当场失败。
// 只读、不启动服务、不碰桌面端。运行：node scripts/render-smoke.mjs [clientPath]
// 背景：0.5.2 面板空白、0.5.4 左栏被拆，都是「注册成功但渲染抛错」，只跑 apply() 拦不住。
import fs from 'node:fs'
import { buildSeq } from './panel-states.mjs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const clientPath = process.argv[2] || path.join(here, '..', 'lib', 'client.js')

const EN = process.env.SMOKE_EN === '1'

let definition
globalThis.window = { __ModuleLoader__: { load(def) { definition = def } }, __EXPERT_ROLE_LANG__: EN ? 'en' : 'zh' }
globalThis.fetch = async (url) => {
  const path = String(url)
  const body = path.includes('/api/settings')
    ? { mode: 'on-request', research: 'serial', lang: EN ? 'en' : 'zh', modes: [], labels: {}, researchModes: [], researchLabels: [], langs: [] }
    : { experts: [], entries: [], totals: {} }
  return { ok: true, status: 200, json: async () => body }
}
await import(pathToFileURL(clientPath).href + '?t=' + Date.now())
if (!definition) throw new Error('client bundle 没有调用 window.__ModuleLoader__.load')

// ---- 假 React：createElement 造树，useState 可被 drive 注入初值 ----
let drive = null
const React = {
  createElement(type, props, ...children) {
    return { type, props: props || {}, children }
  },
  Fragment: 'fragment',
  useState(initial) {
    const index = drive ? drive.i++ : -1
    const value = drive && drive.seq[index] !== undefined ? drive.seq[index] : initial
    return [value, () => {}]
  },
  useEffect() {},
  useCallback(fn) { return fn },
}

const api = definition.factory((name) => {
  if (name !== 'react') throw new Error('未知 require：' + name)
  return React
})

let page = null
let row = null
api.apply({
  effect(fn) { const d = fn(); return typeof d === 'function' ? d : () => {} },
  slots: {
    inject(name, factory) { return factory() },
    register(spec, component) {
      if (spec.name === 'main') page = component
      if (spec.name === 'sidebar.panellist') row = { spec, component }
      return () => {}
    },
  },
})
if (!page) throw new Error('没有注册主区页面')
if (!row) throw new Error('没有注册左栏入口')
if (typeof row.spec.label !== 'function' || !row.spec.label()) throw new Error('左栏入口 label() 返回空')

// ---- 真实形状的假数据 ----
const now = Date.now()
const iso = (msAgo) => new Date(now - msAgo).toISOString()
const experts = [
  {
    id: 'demo-expert', title: '演示专家', level1: '工程与交付', description: '用来渲染的假专家，覆盖主题、标题映射与订阅信息。',
    stage: '可靠', stars: '★★★☆☆', stageHint: '6 个主题 · 16 份资料 · 计划进行中 · 2 个会话用过',
    status: 'surveying', mode: 'parallel', updatedAt: iso(3600e3), sessions: 2,
    survey: {
      goal: '把演示资料整理成可检索的库', mode: 'parallel',
      steps: [{ index: 1, text: '第一批资料', done: true }, { index: 2, text: '第二批资料', done: false }],
      records: [{ step: 1, status: 'done', note: '已收 3 份', at: iso(7200e3) }],
    },
    topics: [
      { id: 't1', title: '提示词', whenToUse: '写或改提示词时', files: ['references/a.md', 'references/b.md'] },
      { id: 't2', title: '一致性', whenToUse: '角色不一致时', files: ['references/c.md'] },
    ],
    titles: { 'references/a.md': '提示词速查', 'references/b.md': '负面词', 'references/c.md': '一致性手段' },
    files: ['SKILL.md', 'manifest.json', 'survey.md', 'references/a.md', 'references/b.md', 'references/c.md'],
      gapTopics: [
        { key: '同行控件高度不一致导致布局位移', title: '同行控件高度不一致导致布局位移', count: 3, lastTs: iso(600e3), decision: null, auto: { action: 'handoff', to: 'dsh-plugin', why: '另一个专家更对口' }, needsApproval: false },
        { key: '正文行高与字号怎么配', title: '正文行高与字号怎么配', count: 1, lastTs: iso(660e3), decision: null, auto: { action: 'research', why: '库里没有相近内容' }, needsApproval: true },
        { key: '表格数字要不要右对齐', title: '表格数字要不要右对齐', count: 2, lastTs: iso(600e3), decision: 'research', auto: { action: 'research', why: '库里没有相近内容' }, needsApproval: true },
      ],

    maturity: {
      score: 78.4, contentScore: 73.1, usageScore: 41, sessions: 2, level: 3,
      dims: { D1: 0.92, D2: 0.7, D3: 0.66, D4: 0.8, D5: 0.4, D6: 0.5 },
      notes: {
        D1: { text: '资料基本上都在：6/6 份能找到', fix: '' },
        D2: { text: '资料分布：一共 6 份，分在 2 个主题里', fix: '补 1 个主题（每个 3 份以上）' },
        D3: { text: '每份资料写得有多细：4 份内容够厚', fix: '' },
        D4: { text: '新旧程度：平均 11 天前整理', fix: '' },
        D5: { text: '有没有人用过：2 个会话用过', fix: '在真实任务里多用一次' },
        D6: { text: '还打算查什么：2 步，完成 1 步', fix: '把计划里没做的步骤做掉' },
      },
      blockers: ['还差 8.6 分到「权威」'],
      queries: { total: 10, hit: 7, rate: 0.7, misses: ['六根手指'], text: '10 个常见问题里，有 7 个能直接找到资料' },
    },
  },
  {
    id: 'empty-expert', title: '空专家', description: '', stage: '起步', stars: '★☆☆☆☆', stageHint: '0 个主题 · 0 份资料',
    status: 'new', mode: 'serial', topics: [], titles: {}, files: [], survey: { steps: [], records: [], goal: '', mode: 'serial' },
  },
]
const trace = [
  { ts: iso(60e3), kind: 'ref_read', session: 'session-demo-1', sessionTitle: '示例会话 A', expert: 'demo-expert', path: 'references/a.md', chars: 1024 },
  { ts: iso(120e3), kind: 'subagent', session: 'session-demo-1', sessionTitle: '示例会话 A', expert: 'demo-expert', children: ['session-demo-task'] },
  { ts: iso(180e3), kind: 'ref_read', session: 'session-demo-task', sessionTitle: '演示调研', expert: 'demo-expert', path: 'references/c.md', chars: 900 },
  { ts: iso(240e3), kind: 'workspace', session: 'session-expert-demo-expert-1794790000000', sessionTitle: '演示工作区', expert: 'demo-expert' },
  { ts: iso(300e3), kind: 'skill_load', session: 'session-demo-task', sessionTitle: '演示调研', expert: 'demo-expert', chars: 661 },
  { ts: iso(360e3), kind: 'remind', session: 'session-demo-1', sessionTitle: '示例会话 A', expert: 'demo-expert', chars: 120 },
  { ts: iso(420e3), kind: 'write', expert: 'demo-expert', path: 'references/b.md', chars: 300 },
  // 子会话（subagent tool 开的盲测会话）：必须并进父会话，不能单列一条
  { ts: iso(450e3), kind: 'skill_load', session: 'session-demo-3', sessionTitle: '子会话：测一次加载', sessionSubagentLabel: '测模型是否主动加载专家技能', sessionParentId: 'session-demo-1', sessionParentTitle: '示例会话 A', expert: 'demo-expert', chars: 202 },
  { ts: iso(480e3), kind: 'ref_read', session: 'session-demo-2', sessionTitle: '示例会话 B', expert: 'demo-expert', path: 'references/d.md', chars: 2048 },
  { ts: iso(540e3), kind: 'skill_load', session: 'session-demo-2', sessionTitle: '示例会话 B', expert: 'empty-expert', chars: 512 },
  { ts: iso(600e3), kind: 'miss', session: 'session-demo-1', sessionTitle: '示例会话 A', expert: 'demo-expert', query: '同行控件高度不一致导致布局位移' },
  { ts: iso(660e3), kind: 'miss', session: 'session-demo-2', sessionTitle: '示例会话 B', expert: 'demo-expert', query: '正文行高与字号怎么配' },
]
const day = (n) => new Date(now - n * 86400e3).toISOString().slice(0, 10)
const stats = {
  root: 'C:/demo/AIExperts', days: 30,
  totals: { readsThisWeek: 12, writesThisWeek: 3, readsInWindow: 40, sessions: 2, expertsUsed: 1, expertsTotal: 2, filesTotal: 6, unusedFiles: 2 },
  daily: Array.from({ length: 30 }, (_, i) => ({ day: day(29 - i), reads: i % 4, writes: i % 2 })),
  heat: Array.from({ length: 56 }, (_, i) => ({ day: day(55 - i), reads: i % 3, level: i % 3 === 0 ? 0 : (i % 3) })),
  today: { day: day(0), reads: 2 },
  perExpert: [{ id: 'demo-expert', title: '演示专家', uses: 5, lastAt: iso(60e3) }],
  perFile: [{ path: 'references/a.md', expert: 'demo-expert', title: '提示词速查', uses: 3, chars: 1024, lastAt: iso(60e3) }],
  unused: [{ path: 'references/c.md', expert: 'demo-expert', bytes: 2048, updatedAt: iso(86400e3) }],
  recent: trace.filter((e) => e.session),
}

// ---- 遍历树，把函数组件真的调一遍；任何异常都算失败 ----
const failures = []
let collected = []
function walk(node, visited) {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) { node.forEach((child) => walk(child, visited)); return }
  const type = node.type
  if (typeof type === 'function') {
    if (drive && type === page) drive = Object.assign({}, drive, { i: 0 })
    let rendered
    try {
      rendered = type(node.props || {})
    } catch (error) {
      failures.push((type.name || '匿名组件') + '：' + error.message)
      return
    }
    visited.push(type.name || '匿名组件')
    textsOf(rendered, collected)
    walk(rendered, visited)
  }
  const children = node.children || (node.props && node.props.children) || []
  ;[].concat(children).forEach((child) => walk(child, visited))
}

const audit = {
  rows: [
    { ts: new Date(Date.now() - 60000).toISOString(), query: '同行控件高度不一致怎么微调', reasons: ['cross'], top: [{ expert: 'ui-design', title: '同行控件高度不一致', rel: 'references/a', score: 0.68 }, { expert: 'ui-interaction', title: '控件与键盘', rel: 'references/b', score: 0.66 }] },
    { ts: new Date(Date.now() - 120000).toISOString(), query: '库存盘点差异要不要自动生成调整单', reasons: ['low'], top: [{ expert: 'hardware', title: '盘点差异与调整单', rel: 'references/c', score: 0.42 }] },
    { ts: new Date(Date.now() - 300000).toISOString(), query: '动漫少女的 SD 提示词，负面词总是不生效', reasons: [], top: [{ expert: 'ai-image', title: '提示词：结论速查', rel: 'references/d', score: 0.70 }] },
    { ts: new Date(Date.now() - 600000).toISOString(), query: '阅读器 14px 正文，行高和每行字数怎么定', reasons: [], top: [{ expert: 'reader', title: '字号与行高', rel: 'references/e', score: 0.71 }] },
    { ts: new Date(Date.now() - 900000).toISOString(), query: '游戏挂机脚本经常卡死，怎么排查', reasons: [], top: [{ expert: 'game-automation', title: 'ALAS 架构与看门狗', rel: 'references/f', score: 0.66 }] },
    { ts: new Date(Date.now() - 1200000).toISOString(), query: '商品标题怎么写才规范，平台要改字数', reasons: [], top: [{ expert: 'product', title: '平台商品命名规范', rel: 'references/g', score: 0.64 }] },
  ],
  summary: { days: 7, total: 12, risky: 2, rate: 2 / 12, byReason: { empty: 0, low: 1, close: 0, cross: 1 } },
  labels: { empty: '一份都没找到', low: '分数太低，多半库里没有', close: '前两名分差太小，容易选错', cross: '跨了专家，且分差很小' },
}

const taxonomyFixture = [
  { id: 'platform', title: '平台与运行', order: 1, count: 0, experts: [] },
  { id: 'engineering', title: '工程与交付', order: 2, count: 1, experts: [{ id: 'demo-expert', title: '演示专家' }] },
  { id: 'interface', title: '界面与体验', order: 3, count: 0, experts: [] },
  { id: 'content', title: '内容生产', order: 4, count: 0, experts: [] },
  { id: 'agent', title: '人工智能', order: 5, count: 0, experts: [] },
  { id: 'terminal', title: '终端与场景', order: 6, count: 0, experts: [] },
  { id: 'business', title: '业务与运营', order: 7, count: 0, experts: [] },
  { id: 'misc', title: '专业技术', order: 8, count: 0, experts: [] },
]

const sessionLogFixture = [
  { kind: 'category-turn', ts: '2026-11-19T04:20:00.000Z', session: 'session-expert-cat-06', cat: 6, chars: 320, tools: 3, text: '我负责终端与场景这一类，管阅读器、播放器和安卓挂机自动化三位。' },
  { kind: 'category-turn', ts: '2026-11-19T04:10:00.000Z', session: 'session-expert-cat-03', cat: 3, chars: 180, tools: 1, text: '界面与体验这一类今天没有新问题，库里答得上。' },
  { kind: 'category-turn', ts: '2026-11-19T04:05:00.000Z', session: 'session-expert-cat-02', cat: 2, chars: 240, tools: 2, need: true, needKind: 'spend', reason: '要不要我去补两份资料，会花额度', text: '插件那两份资料缺口没补上。' },
]

const dataDirFixture = {
  active: 'E:\\000Dev\\AIExperts',
  defaultDir: 'C:\\Users\\Admin\\.dsh\\expert-role\\experts',
  candidates: [
    { dir: 'E:\\000Dev\\AIExperts', kind: 'pointer', experts: 13, systemDrive: false },
  ],
  source: 'default',
  overridden: false,
  pending: false,
  restartRequired: false,
}

// useState 顺序的唯一事实来源在 scripts/panel-states.mjs；
// 这里只给每个状态一个值。插队少登记会在 test/panel-states.test.js 里报错。
function seqFor(tab, expertsList, openId, catOverride) {
  return buildSeq({
    experts: expertsList,
    open: openId || null,
    trace,
    files: [],
    content: null,
    stats,
    audit,
    tab,
    cat: catOverride !== undefined ? catOverride : (tab === 'experts' ? '工程与交付' : ''),
    error: '',
    mode: 'on-request',
    research: 'serial',
    lang: 'zh',
    reportMode: 'turn',
    fillMode: 'ask',
    fillSteps: 2,
    fillExperts: [],
    gap: 0.2,
    modeBusy: false,
    dataDir: dataDirFixture,
    dataDirInput: dataDirFixture.active,
    adoptWorkspace: true,
    dataDirCopy: true,
    dataDirBusy: false,
    dataDirNote: '',
    dataDirDeleteOld: false,
    refreshing: false,
    fade: 1,
    updatedAt: 0,
    loading: false,
    taxonomy: taxonomyFixture,
    gapRuns: {},
    sessionLog: sessionLogFixture,
  })
}

const tabs = [
  ['概况', seqFor('overview', experts)],
  ['资料', seqFor('experts', experts, 'demo-expert')],
  ['调用记录', seqFor('trace', experts)],
  ['设置', seqFor('settings', experts)],
  ['自检', seqFor('audit', experts)],
  ['会话动态', seqFor('sessionLog', experts)],
  ['空库', seqFor('overview', [])],
  ['大类', seqFor('experts', experts, null, '')],
]

function textsOf(node, out) {
  out = out || []
  if (node === null || node === undefined || node === false) return out
  if (typeof node === 'string' || typeof node === 'number') { out.push(String(node)); return out }
  if (Array.isArray(node)) { node.forEach((child) => textsOf(child, out)); return out }
  if (typeof node !== 'object') return out
  const children = node.children || (node.props && node.props.children)
  if (children !== undefined) textsOf(children, out)
  return out
}

for (const [name, seq] of tabs) {
  drive = { seq, i: 0 }
  const visited = []
  walk({ type: page, props: {} }, visited)
  console.log('渲染「' + name + '」：' + visited.length + ' 个组件')
  drive = null
}

// 会话动态：按大类分组，能看到每一轮的摘要与工具次数
{
  drive = { seq: tabs[5][1], i: 0 }
  collected = []
  walk({ type: page, props: {} }, collected)
  const text = collected.map((node) => textsOf(node, [])).flat().join('\n')
  if (!text.includes('06 终端与场景')) throw new Error('会话动态没有按大类分组')
  if (!text.includes('我负责终端与场景这一类')) throw new Error('会话动态没有显示这一轮说了什么')
  if (!text.includes('320 字 · 用了 3 次工具')) throw new Error('会话动态没有显示字数与工具次数')
  if (!text.includes('要你看')) throw new Error('会话动态没有「要你看」分组')
  if (!text.includes('要花额度')) throw new Error('「要你看」没标出原因')
  if (!text.includes('其中 1 条在等你')) throw new Error('顶部没有统计几条在等')
  drive = null
}

// 专家页是两级：第一屏只列大类，进去看该类的专家卡
{
  drive = { seq: tabs[7][1], i: 0 }
  collected = []
  walk({ type: page, props: {} }, collected)
  const text = collected.map((node) => textsOf(node, [])).flat().join('\n')
  if (!text.includes('共 2 位专家')) throw new Error('大类页没有写共几位专家')
  if (!text.includes('这一类还没有专家')) throw new Error('大类页没有给空类目留位')
  if (!text.includes('工程与交付')) throw new Error('大类页没有列出大类名')
  drive = null
}

{
  drive = { seq: tabs[1][1], i: 0 }
  collected = []
  walk({ type: page, props: {} }, collected)
  const text = collected.map((node) => textsOf(node, [])).flat().join('\n')
  if (!text.includes('← 所有大类')) throw new Error('大类里没有返回按钮')
  if (!text.includes('工程与交付')) throw new Error('大类里没有显示当前大类名')
  drive = null
}

// 设置页必须有「资料目录」块：能看见现在用的位置，也有换目录与恢复默认两个按钮
{
  drive = { seq: tabs[3][1], i: 0 }
  collected = []
  walk({ type: page, props: {} }, collected)
  const text = collected.map((node) => textsOf(node, [])).flat().join('\n')
  if (!text.includes('资料目录')) throw new Error('设置页缺少「资料目录」块')
  if (!text.includes('默认位置：')) throw new Error('设置页没有显示默认位置')
  if (!text.includes('换到这里')) throw new Error('设置页缺少「换到这里」按钮')
  if (!text.includes('恢复默认')) throw new Error('设置页缺少「恢复默认」按钮')
  if (!text.includes('这台机器上已有的库')) throw new Error('设置页没有列出已有库')
  if (!text.includes('用这个')) throw new Error('已有库缺少「用这个」按钮')
  if (!text.includes('迁完删掉旧目录')) throw new Error('缺少「迁完删掉旧目录」勾选')
  if (!text.includes('启动时把资料目录放进左侧工作区')) throw new Error('缺少工作区自动采纳开关')
  drive = null
}

// 调用记录必须按会话分组，并把「用到的专家」写出来
{
  drive = { seq: tabs[2][1], i: 0 }
  collected = []
  walk({ type: page, props: {} }, [])
  drive = null
  const text = collected.join(' ')
  if (EN) {
    const CHROME = ['专家库', '刷新', '设置', '概况', '调用记录', '读取失败', '还没有', '位专家', '条记录', '份资料']
    const chromeHits = CHROME.filter((w) => text.includes(w))
    if (chromeHits.length > 0) failures.push('EN：界面文案没翻干净：' + chromeHits.join('、'))
    const cjk = text.replace(/[^\u4e00-\u9fff]/g, '')
    if (false) {
      const leftovers = [...new Set(collected.filter((w) => /[\u4e00-\u9fff]/.test(w)))]
      fs.writeFileSync('.en-leftovers.txt', leftovers.join('\n'), 'utf8')
      failures.push('EN：界面里还剩 ' + cjk.length + ' 个中文字（见 .en-leftovers.txt）')
    }
  }
  // 自检页：必须给出「最近几天几次、几次可能有问题」与四类原因
  {
    drive = { seq: tabs[4][1], i: 0 }
    collected = []
    walk({ type: page, props: {} }, [])
    drive = null
    const auditText = collected.join(' ')
    if (!/查了|lookups/.test(auditText)) failures.push('自检：缺少「最近几天查了几次」汇总')
    if (!/可能有问题|may be off/.test(auditText)) failures.push('自检：缺少「几次可能有问题」')
  }

  // 专家详情：能力说明必须排在资料清单前面，资料清单默认折叠
  {
    drive = { seq: tabs[1][1], i: 0 }
    collected = []
    walk({ type: page, props: {} }, [])
    drive = null
    const detail = collected.join(' ')
    const ability = detail.indexOf(EN ? 'What this expert helps with' : '这位专家能帮你什么')
    const task = detail.indexOf(EN ? 'Find by task' : '按任务找资料')
    const files = detail.indexOf(EN ? 'What is in here' : '这里有什么资料 ·')
    if (detail.length && ability < 0) failures.push('详情：缺少「这位专家能帮你什么」')
    if (detail.length && ability >= 0 && task >= 0 && ability > task) failures.push('详情：「这位专家能帮你什么」应排在「按任务找资料」之前')
    if (detail.length && files >= 0 && task >= 0 && files < task) failures.push('详情：资料清单不应排在「按任务找资料」之前')
    const chips = detail.indexOf(EN ? 'Content score' : '资料分')
    if (detail.length && chips < 0) failures.push('详情：星级下面缺少「资料分 / 使用分 / 自测」胶囊')
    if (detail.length && detail.indexOf(EN ? 'All six dimensions' : '六项明细') < 0) failures.push('详情：六维明细应折叠在「六项明细」里')
    if (detail.length && files < 0) failures.push('详情：缺少折叠的资料清单')
    if (!EN && detail.indexOf('最弱一项是') < 0) failures.push('详情：六项明细的折叠标题要指出最弱一项')
    // 缺口：必须把「哪几句没查到」列出来，而不只是次数
    if (detail.indexOf(EN ? 'Topics it could not answer' : '它答不上来的事') < 0) failures.push('详情：缺少缺口主题清单')
    if (detail.indexOf(EN ? 'handled' : '已处理 ') < 0) failures.push('详情：已处理的缺口应收进折叠行')
    if (detail.indexOf(EN ? 'Approve research' : '同意去查') < 0) failures.push('详情：缺少「同意去查」授权按钮')
    if (!EN && detail.indexOf('正文行高与字号怎么配') < 0) failures.push('详情：缺口清单没有列出主题')
    if (!EN && detail.indexOf('已排队 · 等开查') < 0) failures.push('详情：点过「同意去查」的应显示已排队状态')
  }

  if (EN) {
    if (!text.includes('Experts used')) failures.push('EN：没有显示每个会话用到的专家')
    if (!text.includes('Consulted the')) failures.push('EN：句子没有翻成英文')
    if (!text.includes('Activity')) failures.push('EN：缺少 Activity 页签')
  } else {
    if (!text.includes('用到的专家')) failures.push('调用记录：没有显示每个会话用到的专家')
    if (!text.includes('全部记录')) failures.push('调用记录：缺少选择会话的下拉框')
    if (!text.includes('设置')) failures.push('标签行：缺少「设置」入口')
    if (!text.includes('专家')) failures.push('标签行：缺少「专家」页签')
    if (!text.includes('叫来了') && !text.includes('咨询了')) failures.push('调用记录：句子没有说人话（应是「咨询了 / 叫来了」）')
    if (!text.includes('刷新')) failures.push('标签行：缺少「刷新」按钮')
  }
  {
    const src = fs.readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
    if (src.includes('rgba(250, 250, 252')) failures.push('刷新：还留着整块白闪遮罩（交互建议去掉）')
    if (!src.includes('刷新中')) failures.push('刷新：没有「刷新中」状态')
    if (!src.includes('opacity 100ms ease-out')) failures.push('刷新：没有数据回来后的 100ms 淡入')
  }
  if (!EN) {
    if (!text.includes('子任务 · 测模型是否主动加载专家技能')) failures.push('调用记录：子任务没有标出身份')
    if (text.includes('示例会话 A 的子会话')) failures.push('调用记录：子会话被单列成了一条，应该并进父会话')
  }
}

// DUMP_HTML=路径 时把「概况」渲染成静态 HTML，方便截图复核布局
if (process.env.DUMP_HTML) {
  const CSS_KEBAB = (k) => k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const toHtml = (node) => {
    if (node === null || node === undefined || node === false || node === true) return ''
    if (typeof node === 'string' || typeof node === 'number') return esc(node)
    if (Array.isArray(node)) return node.map(toHtml).join('')
    if (typeof node !== 'object') return ''
    if (typeof node.type === 'function') return toHtml(node.type(node.props || {}))
    const spec = node.props || {}
    const tag = typeof node.type === 'string' ? node.type : 'div'
    const style = spec.style
      ? Object.keys(spec.style).map((k) => CSS_KEBAB(k) + ':' + (typeof spec.style[k] === 'number' && !/^(zIndex|fontWeight|opacity|flex|flexGrow|flexShrink|gridColumn|lineHeight|order)$/.test(k) ? spec.style[k] + 'px' : spec.style[k])).join(';')
      : ''
    const attrs = (style ? ' style="' + esc(style) + '"' : '') +
      (spec.title ? ' title="' + esc(spec.title) + '"' : '') +
      (tag === 'button' ? ' type="button"' : '')
    const kids = toHtml(node.children && node.children.length ? node.children : spec.children)
    return '<' + tag + attrs + '>' + kids + '</' + tag + '>'
  }
  const dumpTab = tabs[Number(process.env.DUMP_TAB || 0)] || tabs[0]
  drive = { seq: dumpTab[1], i: 0 }
  const tree = page({})
  drive = null
  const html = '<!doctype html><meta charset="utf-8"><body style="margin:0;padding:20px;background:#f6f7f9;font-family:system-ui,\'Microsoft YaHei\',sans-serif;color:#1f2937">' + toHtml(tree) + '</body>'
  fs.writeFileSync(process.env.DUMP_HTML, html, 'utf8')
  console.log('已导出 ' + process.env.DUMP_HTML)
}

if (failures.length > 0) {
  console.error('渲染失败：')
  for (const item of new Set(failures)) console.error('  ' + item)
  process.exit(1)
}
console.log('OK：左栏入口「' + row.spec.label() + '」，' + tabs.length + ' 个视图渲染通过')
