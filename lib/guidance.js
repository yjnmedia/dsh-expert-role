import { readSettings } from './settings.js'

import { DEFAULT_FILL_MODE, DEFAULT_FILL_STEPS, DEFAULT_REPORT_MODE, FILL_MODES, FILL_STEPS, REPORT_MODES, STALL_STEPS } from './settings.js'

export const RESEARCH_MODES = ['serial', 'parallel', 'workspace']

/**
 * 补资料要不要先问用户：按 settings.json 的 fillMode 判断。
 *  - ask      每次都要点头
 *  - scoped   事先授权，按 fillSteps 上限自己跑
 *  - experts  只有 fillExperts 白名单里的专家放行
 * 任何一档都只授权「按计划表补资料」，不授权建新专家。
 */
export function fillAuthorization({ expertId, fillMode, fillSteps, fillExperts } = {}) {
  const mode = FILL_MODES.includes(fillMode) ? fillMode : DEFAULT_FILL_MODE
  const steps = FILL_STEPS.includes(Number(fillSteps)) ? Number(fillSteps) : DEFAULT_FILL_STEPS
  const list = Array.isArray(fillExperts) ? fillExperts : []
  const id = String(expertId || '').trim()
  if (mode === 'scoped') return { allowed: true, steps, line: `已授权：直接按上面步骤开始，本次最多 ${steps} 步，跑完汇报。` }
  if (mode === 'experts' && id && list.includes(id)) {
    return { allowed: true, steps, line: `已授权：这位专家在白名单里，直接按上面步骤开始，本次最多 ${steps} 步，跑完汇报。` }
  }
  if (mode === 'experts') {
    return { allowed: false, steps, line: `需要你点头：说「补」我就按上面步骤开始（本次最多 ${steps} 步）；当前只对白名单里的专家自动放行。` }
  }
  return { allowed: false, steps, line: `需要你点头：说「补」我就按上面步骤开始（本次最多 ${steps} 步）。` }
}


/**
 * 调研的汇报节奏（用户 2026-11-18 定）：step 每份停 / turn 只在转向时停（默认）/ auto 跑完再说。
 * 不论哪档，每查完一份都要用 expert_record 写一句小结。
 */
export function rhythmGuide({ reportMode, stallSteps = STALL_STEPS } = {}) {
  const mode = REPORT_MODES.includes(reportMode) ? reportMode : DEFAULT_REPORT_MODE
  if (mode === 'step') {
    return [
      '汇报节奏（每查完一份就停）：每查完一份资料，先用 3–5 句话向用户说清——「这份讲了什么、结论是什么、我想不想改方向、它给了我什么启示」，等用户回应后再往下走；',
      '同时用 expert_record 把这一步的小结写回 survey，别只留在对话里。',
    ].join('\n')
  }
  if (mode === 'auto') {
    return [
      '汇报节奏（全部查完再汇报）：中途不要停下来问，按计划一路做完，最后一次汇报结论、冲突与缺口；',
      '每查完一份仍要用 expert_record 写一句小结，方便事后核对。',
    ].join('\n')
  }
  return [
    `汇报节奏（只在需要转向时停）：平时不用停，每查完一份用 expert_record 写一句不超过 80 字的小结；`,
    `只在这四种情况停下来问用户——① 新资料推翻了原来的假设；② 出现计划外、且看起来更重要的主题；③ 连续 ${stallSteps} 份没拿到有效结论；④ 查到的内容与调研目标对不上。`,
    '其余时候自己往前走，用户随时可以打断。',
  ].join('\n')
}

/** 把「查不到」时的做法写成一段话：按当前检索模式分支，serial 必须交回本会话。 */
export function buildMissGuidance({ query, expertId, research = 'serial', surveyMode, fill, rhythm }) {
  const id = String(expertId || '').trim()
  const mode = RESEARCH_MODES.includes(surveyMode) ? surveyMode : (RESEARCH_MODES.includes(research) ? research : 'serial')
  const head = `现有资料库没有覆盖「${query}」。`
  const who = id ? `当前专家 ${id}` : '当前专家'
  // 专家自己的 survey.md 优先；与全局 research 不一致时，把全局口径也写出来，避免「改了设置没反应」。
  const alt = RESEARCH_MODES.includes(research) && research !== mode
    ? (research === 'parallel'
        ? `另：全局设置 research=parallel，若想按全局走，可改用 expert_dispatch(${id ? `{ expert: "${id}" }` : ''}) 派子会话并行查。`
        : research === 'workspace'
          ? `另：全局设置 research=workspace，若想按全局走，可改用 expert_workspace(${id ? `{ expert: "${id}" }` : ''}) 开独立工作区。`
          : `另：全局设置 research=serial，若想按全局走，就在本会话按步骤检索。`)
    : ''
  const tail = '只有完全不属于任何现有专家职责，且用户明确同意，才用 expert_create 新建专家。'
  const auth = fillAuthorization({ expertId: id, ...(fill || {}) })
  const rhythmLine = rhythmGuide({ reportMode: rhythm?.reportMode, stallSteps: rhythm?.stallSteps })
  const ask = auth.allowed
    ? [auth.line, '（A：先用现有资料给近似答案，并注明缺哪一块；如仍想要近似答案就先说 A。）']
    : ['A：先用现有资料给近似答案，并注明缺哪一块。', `B：${auth.line.replace(/^需要你点头：/, '')}`.trim(), 'C：当前执行器装了 expert_ingest 时，可直接用它把这份结论补进来。']

  if (mode === 'serial') {
    return [
      head,
      `${who} 处于 serial 模式（research=serial）：正确做法是在本会话按步骤检索，而不是手写资料文件、也不是派子智能体——`,
      id ? `1) 调 expert_next({ expert: "${id}" }) 取下一个未完成步骤与产出要求；` : '1) 调 expert_next 取下一个未完成步骤与产出要求；',
      '2) 在本会话内完成该步，结论写成这位专家 references/ 下的一份文件；',
      id
        ? `3) 调 expert_record({ expert: "${id}", step: N, status: "done", summary: "关键数字与来源" }) 把结论写回 survey。`
        : '3) 调 expert_record(step: N, status: "done", summary: "关键数字与来源") 把结论写回 survey。',
      '',
      '',
      rhythmLine,
      '',
      ...ask,
      '',
      alt,
      tail,
    ].filter((line) => line !== '' || true).join('\n')
  }

  if (mode === 'parallel') {
    return [
      head,
      `${who} 处于 parallel 模式（research=parallel）：可以派子会话并行查，也可以在会话里一条条查——`,
      id ? `1) 派子会话用 expert_dispatch({ expert: "${id}" })；` : '1) 派子会话用 expert_dispatch；',
      id
        ? `2) 结论回填 expert_record({ expert: "${id}", step: N, status: "done", summary })；`
        : '2) 结论回填 expert_record(step: N, status: "done", summary)；',
      '',
      '',
      rhythmLine,
      '',
      ...ask,
      '',
      alt,
      tail,
    ].join('\n')
  }

  return [
    head,
    `${who} 处于 workspace 模式（research=workspace）：开一个独立工作区去查，不占主对话上下文——`,
    id ? `1) 调 expert_workspace({ expert: "${id}" })；` : '1) 调 expert_workspace；',
    id
      ? `2) 工作区跑完后用 expert_record({ expert: "${id}", step: N, status: "done", summary }) 回填。`
      : '2) 工作区跑完后用 expert_record 回填。',
    '',
    '',
    rhythmLine,
    '',
    ...ask,
    '',
    alt,
    tail,
  ].join('\n')
}

/** 查不到时用：读设置与 survey 的模式，给出可执行的做法。 */
export async function missGuidance({ library, expertId, query }) {
  let research = 'serial'
  let fill = {}
  let rhythm = {}
  try {
    const settings = await readSettings(library.root)
    research = settings?.research ?? 'serial'
    fill = { fillMode: settings?.fillMode, fillSteps: settings?.fillSteps, fillExperts: settings?.fillExperts }
    rhythm = { reportMode: settings?.reportMode, stallSteps: STALL_STEPS }
  } catch {}
  let surveyMode
  if (expertId) {
    try {
      surveyMode = (await library.readExpert(expertId))?.survey?.mode
    } catch {}
  }
  return buildMissGuidance({ query, expertId, research, surveyMode, fill, rhythm })
}
