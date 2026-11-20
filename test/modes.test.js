import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { ExpertLibrary, parseSurvey } from '../lib/library.js'
import { createToolDefinitions } from '../lib/tools.js'
import { computeStats } from '../lib/stats.js'

async function tempLibrary(t) {
  const base = join(process.cwd(), '.tmp')
  await mkdir(base, { recursive: true })
  const root = await mkdtemp(join(base, 'mode-test-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const library = new ExpertLibrary(root)
  await library.ensureRoot()
  return library
}

function tools(library) {
  const list = createToolDefinitions(library)
  return (name) => list.find((tool) => tool.name === name)
}

async function makeExpert(library) {
  await tools(library)('expert_create').execute({ id: 'demo', title: '演示', description: '演示用' }, {})
  await tools(library)('expert_plan').execute({ expert: 'demo', goal: '查清楚', mode: 'serial', steps: ['第一件事', '第二件事', '第三件事'] }, {})
}

test('expert_plan 只改目标时保留步骤与打勾', async (t) => {
  const library = await tempLibrary(t)
  await makeExpert(library)
  await tools(library)('expert_record').execute({ expert: 'demo', step: 1, status: 'done', summary: '做完了' }, {})
  const plan = tools(library)('expert_plan')
  await plan.execute({ expert: 'demo', goal: '改过的目标' }, {})
  const survey = parseSurvey(await library.readText(join('demo', 'survey.md')))
  assert.equal(survey.goal, '改过的目标')
  assert.equal(survey.mode, 'serial')
  assert.deepEqual(survey.steps.map((s) => s.done), [true, false, false])
  assert.equal(survey.records.length, 1)
})

test('expert_mode 只切模式，不动步骤进度', async (t) => {
  const library = await tempLibrary(t)
  await makeExpert(library)
  await tools(library)('expert_record').execute({ expert: 'demo', step: 1, status: 'done', summary: '做完了' }, {})
  const out = await tools(library)('expert_mode').execute({ expert: 'demo', mode: 'parallel' }, {})
  assert.match(out.text, /parallel/)
  const survey = parseSurvey(await library.readText(join('demo', 'survey.md')))
  assert.equal(survey.mode, 'parallel')
  assert.deepEqual(survey.steps.map((s) => s.done), [true, false, false])
  const manifest = await library.readJson(join('demo', 'manifest.json'), {})
  assert.equal(manifest.mode, 'parallel')
})

test('expert_mode 没有计划时拒绝切换', async (t) => {
  const library = await tempLibrary(t)
  await tools(library)('expert_create').execute({ id: 'empty', title: '空', description: '空专家' }, {})
  const out = await tools(library)('expert_mode').execute({ expert: 'empty', mode: 'serial' }, {})
  assert.match(out.text, /还没有调研计划/)
})

test('expert_next 按顺序给下一条，完成后跳过', async (t) => {
  const library = await tempLibrary(t)
  await makeExpert(library)
  const first = await tools(library)('expert_next').execute({ expert: 'demo' }, {})
  assert.match(first.text, /第一件事/)
  assert.equal(first.count, 3)
  assert.match(first.text, /expert_record/)
  await tools(library)('expert_record').execute({ expert: 'demo', step: 1, status: 'done', summary: '第一步完成' }, {})
  const second = await tools(library)('expert_next').execute({ expert: 'demo' }, {})
  assert.match(second.text, /第二件事/)
  assert.doesNotMatch(second.text, /第一件事/)
})

test('expert_next 全部完成时给收尾建议', async (t) => {
  const library = await tempLibrary(t)
  await makeExpert(library)
  for (const step of [1, 2, 3]) {
    await tools(library)('expert_record').execute({ expert: 'demo', step, status: 'done', summary: '完成' }, {})
  }
  const out = await tools(library)('expert_next').execute({ expert: 'demo' }, {})
  assert.equal(out.count, 0)
  assert.match(out.text, /计划已全部完成/)
})

test('computeStats 聚合读取次数、专家占比与未用资料', async (t) => {
  const library = await tempLibrary(t)
  await makeExpert(library)
  await library.writeText(join('demo', 'references', '01-提示词.md'), '# 提示词')
  await library.writeText(join('demo', 'references', '02-一致性.md'), '# 一致性')
  const now = Date.now()
  const iso = (offsetDays) => new Date(now - offsetDays * 86_400_000).toISOString()
  for (const [ts, path] of [
    [iso(1), 'demo/references/01-提示词.md'],
    [iso(2), 'demo/references/01-提示词.md'],
    [iso(3), 'demo/references/02-一致性.md'],
  ]) {
    await library.appendTrace({ ts, kind: 'ref_read', expert: 'demo', path, chars: 1000, session: 'session-demo' })
  }
  await library.appendTrace({ ts: iso(0), kind: 'skill_load', expert: 'demo', chars: 600, session: 'session-demo' })
  await library.appendTrace({ ts: iso(0), kind: 'write', expert: 'demo', path: 'demo/survey.md' })
  const stats = await computeStats(library, { days: 7, now })
  assert.equal(stats.totals.readsInWindow, 4)
  // expert_create / expert_plan / 手动 write 各记一条写入
  assert.equal(stats.totals.writesThisWeek, 3)
  assert.equal(stats.totals.sessions, 1)
  assert.equal(stats.daily.length, 7)
  assert.equal(stats.heat.length, 56)
  assert.equal(stats.perExpert[0].id, 'demo')
  assert.equal(stats.perFile[0].path, 'demo/references/01-提示词.md')
  assert.equal(stats.perFile[0].uses, 2)
  assert.ok(stats.unused.some((file) => file.path === 'demo/references/02-一致性.md') === false)
  assert.equal(stats.today.reads, 1)
})

test('computeStats 按专家过滤', async (t) => {
  const library = await tempLibrary(t)
  await tools(library)('expert_create').execute({ id: 'a', title: 'A', description: 'A' }, {})
  await tools(library)('expert_create').execute({ id: 'b', title: 'B', description: 'B' }, {})
  const iso = new Date().toISOString()
  await library.appendTrace({ ts: iso, kind: 'skill_load', expert: 'a', chars: 10 })
  await library.appendTrace({ ts: iso, kind: 'skill_load', expert: 'b', chars: 10 })
  const stats = await computeStats(library, { days: 7, expert: 'a' })
  assert.equal(stats.totals.readsInWindow, 1)
  assert.deepEqual(stats.perExpert.map((item) => item.id), ['a'])
})
