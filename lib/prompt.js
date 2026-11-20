/**
 * 静态系统提示词：只有一条，措辞按当前模式切换。
 * 用函数形式取文本，这样面板里改了模式不用重载插件。
 *
 * 三档对应 lib/settings.js 的 mode：
 *  - auto       允许模型自己判断相关就查
 *  - on-request 只在用户明确要求调用某专家/资料库时才查
 *  - off        一个字都不注入，专家库完全静默
 */
export const CONSULT_RULE_NAME = 'expert-role:consult-rule'
export const CONSULT_RULE_ORDER = 4950

const TEXT_AUTO = [
  '本机有一个领域专家资料库（专家角色）。下面这些方向的问题，先调用 lookup_expert_knowledge 查一下，',
  '或者加载对应的 expert-* 技能，再回答：AI 生图、AI 短剧、阅读器、播放器、安卓游戏自动化、DSH 插件、界面与交互设计。',
  '资料库没有覆盖的内容，直接说「资料库没有」，不要凭模型记忆补。',
].join('')

const TEXT_ON_REQUEST = [
  '本机有一个领域专家资料库（专家角色），但只在用户明确要求时才用：',
  '用户说「调用 / 问问 / 请教 / 查阅 / 用某个专家或某个资料库」时，先调用 lookup_expert_knowledge 查一下，',
  '或者加载对应的 expert-* 技能，再回答；资料库没有覆盖的内容，直接说「资料库没有」，不要凭模型记忆补。',
  '用户没有明确点名时，不要主动查这个资料库，也不要主动加载其它专家技能——技能目录里只保留「总入口」一张卡，需要时先读它。',
].join('')

let currentMode = 'on-request'

export function setPromptMode(mode) {
  currentMode = mode
}

export function promptTextFor(mode) {
  if (mode === 'auto') return TEXT_AUTO
  if (mode === 'on-request') return TEXT_ON_REQUEST
  return ''
}

export function registerPrompt(ctx) {
  if (!ctx.systemPrompt?.section) return () => {}
  return ctx.systemPrompt.section({
    name: CONSULT_RULE_NAME,
    order: CONSULT_RULE_ORDER,
    text: () => promptTextFor(currentMode),
  })
}
