import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildMissGuidance, missGuidance } from '../lib/guidance.js'
import { writeSettings } from '../lib/settings.js'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('serial 模式：把流程交回本会话，明确 next/record，不派子智能体', () => {
  const text = buildMissGuidance({ query: '行高位移', expertId: 'ui-design', research: 'serial' })
  assert.match(text, /serial/)
  assert.match(text, /expert_next\(\{ expert: "ui-design" \}\)/)
  assert.match(text, /expert_record/)
  assert.match(text, /不是派子智能体|不要派子智能体/)
  assert.doesNotMatch(text, /新建专家角色/)
})

test('parallel 模式：改为派子会话口径', () => {
  const text = buildMissGuidance({ query: 'x', expertId: 'ui-design', research: 'parallel' })
  assert.match(text, /parallel/)
  assert.match(text, /expert_dispatch/)
  assert.doesNotMatch(text, /在本会话按步骤检索/)
})

test('workspace 模式：改为独立工作区口径', () => {
  const text = buildMissGuidance({ query: 'x', expertId: 'reader', research: 'workspace' })
  assert.match(text, /workspace/)
  assert.match(text, /expert_workspace/)
})

test('survey 里的 mode 优先于全局 research', () => {
  const text = buildMissGuidance({ query: 'x', expertId: 'a', research: 'parallel', surveyMode: 'serial' })
  assert.match(text, /serial/)
})

test('missGuidance 读设置：research=parallel 时提示派子会话', async () => {
  const root = await mkdtemp(join(tmpdir(), 'guidance-'))
  await writeSettings(root, { mode: 'auto', research: 'parallel', lang: 'auto', gap: 0.2 })
  await mkdir(join(root, 'demo'), { recursive: true })
  await writeFile(join(root, 'demo', 'survey.md'), '# demo\n\nmode: parallel\n\n## 目标\n\nx\n')
  const library = {
    root,
    async readExpert() {
      return { id: 'demo', title: 'Demo', survey: { mode: 'parallel', steps: [], records: [], goal: 'x' } }
    },
  }
  const text = await missGuidance({ library, expertId: 'demo', query: '库里没有的问题' })
  assert.match(text, /parallel/)
  assert.match(text, /expert_dispatch/)
})

test('补资料授权：默认每次问，提前授权或有白名单才自跑', async () => {
  const { fillAuthorization, buildMissGuidance } = await import('../lib/guidance.js')

  const ask = fillAuthorization({ expertId: 'ui-design' })
  assert.equal(ask.allowed, false)
  assert.match(ask.line, /需要你点头/)

  const scoped = fillAuthorization({ expertId: 'ui-design', fillMode: 'scoped', fillSteps: 3 })
  assert.equal(scoped.allowed, true)
  assert.match(scoped.line, /最多 3 步/)

  const inList = fillAuthorization({ expertId: 'ui-design', fillMode: 'experts', fillExperts: ['ui-design'] })
  assert.equal(inList.allowed, true)

  const notInList = fillAuthorization({ expertId: 'reader', fillMode: 'experts', fillExperts: ['ui-design'] })
  assert.equal(notInList.allowed, false)
  assert.match(notInList.line, /白名单/)

  const text = buildMissGuidance({
    query: 'q',
    expertId: 'ui-design',
    research: 'serial',
    surveyMode: 'serial',
    fill: { fillMode: 'scoped', fillSteps: 2 },
  })
  assert.match(text, /已授权：直接按上面步骤开始/)
  assert.ok(!text.includes('新建专家角色'))
})

test('汇报节奏三档：默认只在转向时停，且写明连续 2 份没结论就停', async () => {
  const { rhythmGuide } = await import('../lib/guidance.js')
  const turn = rhythmGuide({ reportMode: 'turn' })
  assert.match(turn, /只在需要转向时停/)
  assert.match(turn, /连续 2 份/)
  assert.match(turn, /80 字/)

  const step = rhythmGuide({ reportMode: 'step' })
  assert.match(step, /每查完一份就停/)
  assert.match(step, /等用户回应/)

  const auto = rhythmGuide({ reportMode: 'auto' })
  assert.match(auto, /全部查完再汇报/)
  assert.match(auto, /不要停下来问/)
})
