// 让插件在自己的进程里开一个新会话，并把开场消息真正投递进去。
// 依据（DSH 0.2.2-rc.3 实测）：ctx.agents.create({sessionId, meta:{cwd}, agentOptions})
// 能建出会话并出现在列表里；但 agent 没有 provider/model 时回合会被静默吞掉，
// 所以必须把调用方 agent 当前的模型抄过去。

import { randomUUID } from 'node:crypto'

/** 读出调用方 agent 当前选的模型；没有就返回 undefined。 */
export function modelOf(exec) {
  try {
    const current = exec?.agent?.model?.current?.()
    if (current && typeof current === 'object' && current.provider && current.model) {
      return { provider: String(current.provider), model: String(current.model) }
    }
  } catch {
    // 拿不到就当没有；下面会退回到「只给提示，不建会话」。
  }
  return undefined
}

/** 复刻 @deepseek-ai/dsh-llm 的 createUserMessage：冻结的 user 消息，带稳定 id。 */
export function userMessage(text) {
  return {
    id: randomUUID(),
    role: 'user',
    content: [{ type: 'text', text: String(text) }],
    source: { kind: 'user' },
  }
}

/**
 * 只建会话，不投递消息。工作区和派发子任务都要先过这一步，才能都继承调用方预设。
 * @returns {Promise<{sessionId: string, agent?: object, error?: string}>}
 */
export async function createAgent({ ctx, cwd, model, sessionId, parent }) {
  const agents = ctx?.agents
  if (!agents || typeof agents.create !== 'function') {
    return { sessionId: null, error: '当前宿主没有 agents 服务，建不了会话' }
  }
  const id = sessionId ?? `session-expert-${randomUUID()}`
  // 新会话必须加入调用方 agent 的预设，否则只有全局工具（没有 read / bash / write），
  // 调研子会话连资料都读不了。见 dsh-agent-preset-registry 的 composeFrom。
  // agentPresets 不是所有 profile 都有（headless 就没有），用 ctx.get 拿，拿不到就跳过预设继承。
  const presets = typeof ctx?.get === 'function' ? ctx.get('agentPresets') : undefined
  const parentCtx = parent?.ctx
  const setup = presets && typeof presets.composeFrom === 'function' && parentCtx
    ? (agentCtx) => {
      try {
        presets.composeFrom(agentCtx, parentCtx)
      } catch {
        // 父 agent 没有预设（预设为空的组合）时保持原样，让子会话至少有全局工具。
      }
    }
    : undefined
  let handle
  try {
    handle = await agents.create({
      sessionId: id,
      meta: { cwd },
      ...(setup ? { setup } : {}),
      ...(model ? { agentOptions: { provider: model.provider, model: model.model } } : {}),
    })
  } catch (error) {
    // 建会话失败时把 id 留空：调用方据此区分「没建成」和「建成了但没跑起来」。
    return { sessionId: null, error: `建会话失败：${error?.message ?? error}` }
  }
  return { sessionId: id, agent: handle.agent, dispose: handle.dispose }
}

/**
 * 建一个独立会话并投递开场消息。
 * @returns {{sessionId: string|null, error?: string}}
 */
export async function openSession({ ctx, cwd, kickoff, model, sessionId, parent }) {
  const created = await createAgent({ ctx, cwd, model, sessionId, parent })
  if (created.error) return { sessionId: created.sessionId || null, error: created.error }
  try {
    created.agent.followup(userMessage(kickoff))
  } catch (error) {
    return { sessionId: created.sessionId, error: `会话已建，但开场消息没投递进去：${error?.message ?? error}` }
  }
  return { sessionId: created.sessionId }
}

/**
 * 接回一个已经存在的会话继续跑（工作区档复用同一个会话）。
 * 依据 dsh-agent/lib/index.js:595 的 `resume({ resumeSessionId, agentOptions, setup })`。
 * @returns {Promise<{sessionId: string|null, agent?: object, error?: string}>}
 */
export async function resumeSession({ ctx, sessionId, model, parent }) {
  const agents = ctx?.agents
  if (!agents || typeof agents.resume !== 'function') {
    return { sessionId: null, error: '当前宿主不支持接回已有会话' }
  }
  const presets = typeof ctx?.get === 'function' ? ctx.get('agentPresets') : undefined
  const parentCtx = parent?.ctx
  const setup = presets && typeof presets.composeFrom === 'function' && parentCtx
    ? (agentCtx) => {
      try {
        presets.composeFrom(agentCtx, parentCtx)
      } catch {
        // 同 createAgent：拿不到预设就保持原样
      }
    }
    : undefined
  try {
    const handle = await agents.resume({
      resumeSessionId: sessionId,
      ...(setup ? { setup } : {}),
      ...(model ? { agentOptions: { provider: model.provider, model: model.model } } : {}),
    })
    return { sessionId, agent: handle.agent, dispose: handle.dispose }
  } catch (error) {
    return { sessionId: null, error: `接回会话失败：${error?.message ?? error}` }
  }
}

/**
 * 工作区会话的固定号码：同一个专家永远算出同一个，不再带时间戳。
 * 这样「上一次的调研」和「这一次的调研」是同一个窗口，能接着往上翻。
 */
export function workspaceSessionIdOf(expertId) {
  return `session-expert-${String(expertId).replace(/[^A-Za-z0-9._-]/g, '-')}-workspace`
}
