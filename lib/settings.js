/**
 * 专家库的运行设置，存在库根下的 settings.json。
 *
 * mode 三档（用户 2026-11-16 定）：
 *  - auto       会话自动识别当前输入属于哪个专家库并调用（默认，用户 2026-11-17 定）
 *  - on-request 只有在用户明确说「调用 / 问问 / 查阅某专家或资料库」时才调用（默认）
 *  - off        任何输入都不主动调用，专家库只是个静态资料库；建库、派发等工具照常可用
 */
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export const MODES = ['auto', 'on-request', 'off']

/**
 * 界面语言（用户 2026-11-16 定）：
 *  - auto  跟随系统：中文系统用中文，其余用英文
 *  - zh    中文
 *  - en    English（只翻界面文案，专家名与资料名是库里的数据，保持原样）
 */
export const LANGS = ['auto', 'zh', 'en']
export const DEFAULT_LANG = 'auto'

/**
 * 三种调研方式（用户 2026-11-16 定）：
 *  - parallel   并行：主智能体定规划，派多个子智能体同时查，收回再合并去重
 *  - serial     串行：主智能体自己一条条查，每条回来再改后面的方向（默认）
 *  - workspace  独立工作区：另开会话专门调研，不占主对话
 */
export const RESEARCH = ['parallel', 'serial', 'workspace']
/**
 * 暂停使用的调研方式（用户 2026-11-17 定）：代码留着，入口先关掉，等整体做完再测。
 * 选择它会被拒绝，读设置时也退回默认档。
 */
export const RESEARCH_DISABLED = ['workspace']
/** 临时开关：把 `DSH_EXPERT_ENABLE_WORKSPACE=1` 才把「单独开一个会话」算作可选（只给测试与以后开放用）。 */
export function workspaceEnabled(env = process.env) {
  return String(env?.DSH_EXPERT_ENABLE_WORKSPACE ?? '') === '1'
}
/** 当前可选的调研方式。 */
export function researchEnabled(env = process.env) {
  return RESEARCH.filter((item) => !RESEARCH_DISABLED.includes(item) || workspaceEnabled(env))
}
export const RESEARCH_ENABLED = researchEnabled()
export const DEFAULT_RESEARCH = 'serial'

/**
 * 资料缺口提醒阈值（用户 2026-11-17 定）：现存资料答不上来的比例超过它，就在回复末尾提一句「要不要补资料」。
 * 默认 20%。
 */
export const GAP_OPTIONS = [0.1, 0.2, 0.3, 0.5]
export const DEFAULT_GAP = 0.2

export const RESEARCH_LABELS = {
  parallel: '并行（派子智能体同时查）',
  serial: '串行（自己一条条查，不开新会话）',
  workspace: '独立工作区（暂停使用）',
}
/**
 * 补资料的授权口径（用户 2026-11-17 定，默认最保守）：
 *  - ask      每次都要用户点头（默认）
 *  - scoped   事先授权：按「最多 N 步」自己跑，跑完汇报
 *  - experts  只对白名单里的专家放行，其余仍然每次问
 * 不论哪档，都只允许「按计划表补资料」，不允许建新专家。
 */
export const FILL_MODES = ['ask', 'scoped', 'experts']
export const DEFAULT_FILL_MODE = 'ask'
export const FILL_STEPS = [1, 2, 3, 5]
export const DEFAULT_FILL_STEPS = 2

export const FILL_LABELS = {
  ask: '每次问我',
  scoped: '提前授权，按步数跑',
  experts: '只对指定专家放行',
}

/**
 * 调研的汇报节奏（用户 2026-11-18 定）：
 *  - step  每查完一份资料就停下来汇报（学到什么 / 结论 / 想改的方向 / 启示），等用户回应
 *  - turn  平时不停，只在「该转向」时停（默认）：新资料推翻原假设、出现计划外且更重要的主题、
 *          连续 STALL_STEPS 份没拿到有效结论、查到的与目标不符
 *  - auto  全部跑完再一次汇报
 * 不论哪档，每查完一份都要写一句小结进 survey，面板上随时可看。
 */
export const REPORT_MODES = ['step', 'turn', 'auto']
export const DEFAULT_REPORT_MODE = 'turn'
export const STALL_STEPS = 2

export const REPORT_LABELS = {
  step: '每查完一份就停下来问我',
  turn: '只在需要转向时停下来问我（推荐）',
  auto: '全部查完再汇报',
}

/**
 * 缺口主题的处置（用户 2026-11-18 定）：
 *  - recover   有人已经做过 → 把那次产出整理成一条方法入档，不重新调研
 *  - research  真空白 → 派人去查
 *  - ignore    不需要补（临时资料、归错专家）→ 以后不再记录、不补
 * 键是专家 id 下的主题 key（初次问法原文），值是动作。
 */
export const GAP_ACTIONS = ['recover', 'research', 'ignore']

export const GAP_ACTION_LABELS = {
  recover: '回收',
  research: '去查',
  ignore: '不用补',
}

/**
 * 启动时是否把资料目录采纳成左侧工作区（用户 2026-11-19 定，默认开）。
 * 采纳是幂等的：目录已经是工作区时只会读到原来那条，不会重复登记。
 */
export const DEFAULT_ADOPT_WORKSPACE = true

export const DEFAULT_MODE = 'auto'

export const MODE_LABELS = {
  auto: '自动识别并调用',
  'on-request': '只在点名时调用',
  off: '完全不主动调用',
}

export function settingsPath(root) {
  return join(root, 'settings.json')
}

/** 读设置；文件不存在或坏了都退回默认档，不抛错。 */
export async function readSettings(root) {
  try {
    const raw = await readFile(settingsPath(root), 'utf8')
    const parsed = JSON.parse(raw)
    const mode = MODES.includes(parsed?.mode) ? parsed.mode : DEFAULT_MODE
    const allowed = researchEnabled()
    const research = allowed.includes(parsed?.research) ? parsed.research : DEFAULT_RESEARCH
    const lang = LANGS.includes(parsed?.lang) ? parsed.lang : DEFAULT_LANG
    const gap = GAP_OPTIONS.includes(Number(parsed?.gap)) ? Number(parsed.gap) : DEFAULT_GAP
    const fillMode = FILL_MODES.includes(parsed?.fillMode) ? parsed.fillMode : DEFAULT_FILL_MODE
    const fillSteps = FILL_STEPS.includes(Number(parsed?.fillSteps)) ? Number(parsed.fillSteps) : DEFAULT_FILL_STEPS
    const reportMode = REPORT_MODES.includes(parsed?.reportMode) ? parsed.reportMode : DEFAULT_REPORT_MODE
    const gapDecisions = normalizeGapDecisions(parsed?.gapDecisions)
    const adoptWorkspace = parsed?.adoptWorkspace === false ? false : DEFAULT_ADOPT_WORKSPACE
    const fillExperts = Array.isArray(parsed?.fillExperts)
      ? parsed.fillExperts.filter((id) => typeof id === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(id))
      : []
    return { ...parsed, mode, research, lang, gap, fillMode, fillSteps, fillExperts, reportMode, gapDecisions, adoptWorkspace }
  } catch {
    return {
      mode: DEFAULT_MODE,
      research: DEFAULT_RESEARCH,
      lang: DEFAULT_LANG,
      gap: DEFAULT_GAP,
      fillMode: DEFAULT_FILL_MODE,
      fillSteps: DEFAULT_FILL_STEPS,
      fillExperts: [],
      reportMode: DEFAULT_REPORT_MODE,
      gapDecisions: {},
      adoptWorkspace: DEFAULT_ADOPT_WORKSPACE,
    }
  }
}

/** 只改传进来的字段，其余保留；mode 非法直接拒绝。 */
export async function writeSettings(root, patch = {}) {
  const current = await readSettings(root)
  const next = { ...current, ...patch }
  if (!MODES.includes(next.mode)) {
    throw new Error(`mode 只能是 ${MODES.join(' / ')}，收到：${next.mode}`)
  }
  const allowed = researchEnabled()
  if (RESEARCH_DISABLED.includes(next.research) && !workspaceEnabled()) {
    throw new Error('「单独开一个会话」暂停使用：等整体做完再开放，现在请选并行或串行')
  }
  if (!allowed.includes(next.research)) {
    throw new Error(`research 只能是 ${allowed.join(' / ')}，收到：${next.research}`)
  }
  if (!LANGS.includes(next.lang)) {
    throw new Error(`lang 只能是 ${LANGS.join(' / ')}，收到：${next.lang}`)
  }
  if (!GAP_OPTIONS.includes(Number(next.gap))) {
    throw new Error(`gap 只能是 ${GAP_OPTIONS.join(' / ')}，收到：${next.gap}`)
  }
  if (!FILL_MODES.includes(next.fillMode)) {
    throw new Error(`fillMode 只能是 ${FILL_MODES.join(' / ')}，收到：${next.fillMode}`)
  }
  if (!FILL_STEPS.includes(Number(next.fillSteps))) {
    throw new Error(`fillSteps 只能是 ${FILL_STEPS.join(' / ')}，收到：${next.fillSteps}`)
  }
  if (!REPORT_MODES.includes(next.reportMode)) {
    throw new Error(`reportMode 只能是 ${REPORT_MODES.join(' / ')}，收到：${next.reportMode}`)
  }
  if (!Array.isArray(next.fillExperts)) {
    throw new Error('fillExperts 必须是专家 id 数组')
  }
  if (typeof next.adoptWorkspace !== 'boolean') {
    throw new Error(`adoptWorkspace 只能是 true / false，收到：${next.adoptWorkspace}`)
  }
  next.gapDecisions = normalizeGapDecisions(next.gapDecisions)
  await writeFile(settingsPath(root), `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  return next
}

/** 只保留合法结构：{ 专家 id: { 主题 key: 动作 } }。 */
export function normalizeGapDecisions(input) {
  const out = {}
  if (!input || typeof input !== 'object') return out
  for (const [expertId, topics] of Object.entries(input)) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(expertId)) continue
    if (!topics || typeof topics !== 'object') continue
    const kept = {}
    for (const [key, action] of Object.entries(topics)) {
      if (typeof key !== 'string' || !key.trim() || key.length > 120) continue
      if (!GAP_ACTIONS.includes(action)) continue
      kept[key] = action
    }
    if (Object.keys(kept).length) out[expertId] = kept
  }
  return out
}

/** 记一条主题处置，返回新的设置。action 传 null 表示撤销。 */
export async function setGapDecision(root, expertId, key, action) {
  const current = await readSettings(root)
  const decisions = { ...(current.gapDecisions ?? {}) }
  const forExpert = { ...(decisions[expertId] ?? {}) }
  if (action == null) delete forExpert[key]
  else if (GAP_ACTIONS.includes(action)) forExpert[key] = action
  else throw new Error(`action 只能是 ${GAP_ACTIONS.join(' / ')} 或 null，收到：${action}`)
  if (Object.keys(forExpert).length) decisions[expertId] = forExpert
  else delete decisions[expertId]
  return writeSettings(root, { gapDecisions: decisions })
}
