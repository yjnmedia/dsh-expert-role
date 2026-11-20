import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { ExpertLibrary } from '../lib/library.js'
import { registerTriggerHooks } from '../lib/trigger.js'
import { consultState } from '../lib/trace.js'

async function fixture(mode = 'auto') {
  const root = await mkdtemp(join(tmpdir(), 'expert-trigger-'))
  const library = new ExpertLibrary(root)
  await library.ensureRoot()
  // 0.5.0 起自动提醒受 settings.json 的 mode 控制，默认是 on-request（点名才查）。
  await library.writeJson('settings.json', { mode })
  await library.writeJson(join('ai-image', 'manifest.json'), {
    id: 'ai-image',
    title: 'AI 生图',
    description: '生图资料库',
    mode: 'serial',
    status: 'ready',
    topics: [{ id: 'prompt', title: '提示词', whenToUse: '用户要写或改提示词、调 LoRA 强度时' }],
  })
  await library.writeText(join('ai-image', 'SKILL.md'), '---\nname: expert-ai-image\ndescription: 生图\n---\n\n正文\n')
  return { root, library }
}

function fakeCtx() {
  const listeners = new Map()
  return {
    listeners,
    on(name, handler) {
      listeners.set(name, handler)
      return () => listeners.delete(name)
    },
    effect(factory) {
      const dispose = factory()
      return () => dispose?.()
    },
  }
}

function userMessage(text) {
  return { id: 'u1', role: 'user', content: [{ type: 'text', text }], source: { kind: 'user' } }
}

test('命中领域关键词时，在本步消息末尾插一行提醒，并记一条 remind', async () => {
  const { library } = await fixture()
  const ctx = fakeCtx()
  const dispose = registerTriggerHooks(ctx, library, { consultState })
  const pre = ctx.listeners.get('agent/pre-step')
  const decision = await pre(
    { agent: { session: { id: 'session-a' } }, turn: 1 },
    async () => ({ kind: 'enter', messages: [userMessage('画一个动漫女孩，提示词怎么写')] }),
  )
  assert.equal(decision.messages.length, 2)
  assert.match(decision.messages[1].content[0].text, /lookup_expert_knowledge/)
  assert.match(decision.messages[1].content[0].text, /ai-image/)
  const trace = await library.traceTail(5)
  assert.ok(trace.some((entry) => entry.kind === 'remind' && entry.expert === 'ai-image'))
  dispose()
})

test('同一回合只提醒一次，已查过专家库就不再提醒', async () => {
  const { library } = await fixture()
  const ctx = fakeCtx()
  const dispose = registerTriggerHooks(ctx, library, { consultState })
  const pre = ctx.listeners.get('agent/pre-step')
  const agent = { session: { id: 'session-b' } }
  const next = async () => ({ kind: 'enter', messages: [userMessage('LoRA 怎么和 Lightning 一起用')] })
  const first = await pre({ agent, turn: 1 }, next)
  const second = await pre({ agent, turn: 1 }, next)
  assert.equal(first.messages.length, 2)
  assert.equal(second.messages.length, 1)
  consultState.set('session-b', { expert: 'ai-image', at: Date.now() })
  const third = await pre({ agent, turn: 2 }, next)
  assert.equal(third.messages.length, 1)
  dispose()
})

test('没有命中任何专家时不动消息，也不 steer', async () => {
  const { library } = await fixture()
  const ctx = fakeCtx()
  const dispose = registerTriggerHooks(ctx, library, { consultState })
  let steered = 0
  const agent = { session: { id: 'session-c' }, steer: () => { steered += 1 } }
  const pre = ctx.listeners.get('agent/pre-step')
  const decision = await pre({ agent, turn: 1 }, async () => ({ kind: 'enter', messages: [userMessage('今天天气怎么样')] }))
  assert.equal(decision.messages.length, 1)
  // 0.5.0 起不再注册 turn-stopping 去 steer，避免打断模型自己的节奏
  assert.equal(ctx.listeners.has('agent/turn-stopping'), false)
  assert.equal(steered, 0)
  dispose()
})

test('关键词按命中次数取胜：阅读器问题不被界面专家抢走', async () => {
  const { keywordHit } = await import('../lib/trigger.js')
  const rows = [
    { id: 'ui-design', title: '界面与交互', words: ['字号', '控件'] },
    { id: 'reader', title: '阅读器', words: ['行高', '字号', '段距', '每行字数'] },
  ]
  const hit = keywordHit('阅读器正文 14px 字号，行高、每行字数、段间距定多少', rows)
  assert.equal(hit.expertId, 'reader')
})

test('中性技术问题不触发提醒（英文碎片与文件名不再当关键词）', async () => {
  const { rowsOf, keywordHit } = await import('../lib/trigger.js')
  const { ExpertLibrary } = await import('../lib/library.js')
  const rows = await rowsOf(new ExpertLibrary(process.env.DSH_EXPERT_ROOT ?? 'C:/AIExperts'))
  if (rows.length === 0) return
  const neutral = [
    'git rebase -i HEAD~3 打开后怎么把中间那个 commit 删掉？',
    '写个 Python 脚本统计目录下所有 .md 文件的总行数。',
    '把这个 JSON 转成 YAML',
  ]
  for (const text of neutral) assert.equal(keywordHit(text, rows), undefined, text)
})

test('auto 档只在提问/求助时提醒，闲聊与陈述不触发', async () => {
  const { shouldRemind } = await import('../lib/trigger.js')
  assert.equal(shouldRemind('同行控件高度不一致怎么微调？'), true)
  assert.equal(shouldRemind('帮我看看阅读器行高定多少'), true)
  assert.equal(shouldRemind('我今天生图好慢'), false)
  assert.equal(shouldRemind('随便聊聊，生图这事不着急'), false)
  assert.equal(shouldRemind('这个面板我改好了'), false)
})
