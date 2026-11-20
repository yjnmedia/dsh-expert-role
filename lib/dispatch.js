// 真派发：给每个子任务建一个独立会话，投递任务，等它跑完把结论收回来。
// 依据（DSH 0.2.2-rc.3 源码）：
//  - ctx.agents.create({sessionId, meta, agentOptions}) 建 agent；agent.followup(message) 投递并唤醒回合。
//  - agentOptions 必须带 provider/model，否则 kick() 里 catch 吞掉异常、回合永远起不来。
//  - ctx.on('session/event', (session, event)) 能收到 assistant/message，用来收正文。
//  - ctx.on('agent/turn-stopping', ({agent})) 在一轮结束时触发，用来判定跑完。

import { randomUUID } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { createAgent, modelOf, userMessage } from './session.js'

/** 取助手这一轮说过的文本（多条按顺序拼）。 */
function textOfMessage(data) {
  // 事件形状：event.data.message.content（见 dsh-acp/src/updates.ts assistantUpdates）。
  const message = data?.message ?? data
  const content = Array.isArray(message?.content) ? message.content : []
  return content
    .filter((item) => item?.type === 'text')
    .map((item) => String(item.text ?? ''))
    .join('\n')
}

/**
 * 建一个子会话跑一段任务，等它跑完。
 * @returns {Promise<{sessionId: string, text: string, error?: string, ms: number}>}
 */
export async function runTask(ctx, { model, prompt, cwd, timeoutMs = 180_000, parent }) {
  const started = Date.now()
  if (!ctx?.agents || typeof ctx.agents.create !== 'function') {
    return { sessionId: '', text: '', error: '当前宿主没有 agents 服务，无法派发', ms: 0 }
  }
  const sessionId = `session-expert-task-${randomUUID()}`
  const chunks = []
  const offEvent = ctx.on('session/event', (session, event) => {
    if (session?.header?.id !== sessionId) return
    if (event?.type !== 'assistant/message') return
    const text = textOfMessage(event.data)
    if (text) chunks.push(text)
  })

  let resolveDone
  const done = new Promise((resolve) => {
    resolveDone = resolve
  })
  const offStop = ctx.on('agent/turn-stopping', ({ agent }) => {
    if (agent?.id === sessionId) resolveDone('done')
  })

  let error
  try {
    // 走和「独立工作区」同一条建会话路径，才会继承调用方预设，子会话才拿得到 read/write/bash。
    const created = await createAgent({ ctx, cwd, model, sessionId, parent })
    if (created.error) throw new Error(created.error)
    created.agent.followup(userMessage(prompt))
    const timer = new Promise((resolve) => setTimeout(() => resolve('timeout'), timeoutMs))
    const outcome = await Promise.race([done, timer])
    if (outcome === 'timeout') error = `超时（${Math.round(timeoutMs / 1000)} 秒）`
  } catch (cause) {
    error = cause?.message ?? String(cause)
  } finally {
    offEvent?.()
    offStop?.()
  }

  return { sessionId, text: chunks.join('\n\n').trim(), error, ms: Date.now() - started }
}

/** 把一段长文本截到 n 字，避免把整篇塞进 survey。 */
export function clip(text, n = 1200) {
  const value = String(text ?? '').trim()
  return value.length > n ? `${value.slice(0, n)}…（已截断，全文在会话 ${''}）` : value
}

/**
 * 并行跑一批子任务，回调每完成一个。
 * @param {{step:number,text:string,prompt:string}[]} tasks
 */
export async function runTasksInParallel(ctx, tasks, { model, cwd, timeoutMs, concurrency = 4, onDone, parent } = {}) {
  const results = new Array(tasks.length)
  let cursor = 0
  async function worker() {
    while (cursor < tasks.length) {
      const index = cursor
      cursor += 1
      const task = tasks[index]
      const result = await runTask(ctx, { model, prompt: task.prompt, cwd, timeoutMs, parent })
      results[index] = { ...task, ...result }
      onDone?.(results[index], index)
    }
  }
  const size = Math.max(1, Math.min(concurrency, tasks.length))
  await Promise.all(Array.from({ length: size }, () => worker()))
  return results
}

/**
 * 工作区子会话跑完后，把 out\ 里的产出收成一条进度记录。
 * 只在那一轮结束时触发一次，收完即注销监听。
 */
export function watchWorkspace({ ctx, library, expertId, sessionId, outDir }) {
  if (typeof ctx?.on !== 'function' || !sessionId) return () => {}
  let done = false
  const off = ctx.on('agent/turn-stopping', async ({ agent }) => {
    if (done || agent?.id !== sessionId) return
    done = true
    try {
      const names = await readdir(outDir).catch(() => [])
      const files = names.filter((name) => name.endsWith('.md'))
      if (files.length === 0) return
      const pieces = []
      for (const name of files) {
        const text = await readFile(join(outDir, name), 'utf8').catch(() => '')
        if (text) pieces.push(`【${name}】${text.trim().slice(0, 600)}`)
      }
      if (pieces.length === 0) return
      const expert = await library.readExpert(expertId)
      const pending = expert.survey.steps.find((item) => !item.done)
      // 子会话自己记完最后一步时已经没有待做步骤了，别再凭空造一个“第 N+1 步”；
      // 这种情况把产出挂到最后一步上，只记记录、不改打勾状态。
      const step = pending?.index ?? expert.survey.steps.at(-1)?.index ?? 1
      await library.updateSurvey(expertId, {
        steps: pending
          ? expert.survey.steps.map((item) =>
            item.index === step ? { ...item, done: true } : item,
          )
          : expert.survey.steps,
        records: [
          ...expert.survey.records,
          {
            step,
            status: 'done',
            summary: `工作区产出 ${files.length} 份：${pieces.join(' ').slice(0, 900)}`,
            at: new Date().toISOString(),
          },
        ],
      })
      await library.appendTrace({ session: sessionId, kind: 'workspace', expert: expertId, path: `${expertId}/workspace/out`, chars: pieces.join('').length })
    } finally {
      off?.()
    }
  })
  return off
}

export { modelOf }
