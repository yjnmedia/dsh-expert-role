// 离线宿主冒烟：用假的 ctx 跑一遍 apply()，模拟 DSH 对 provider / tool / route 的校验。
// 用途：装进 profile 之前先确认不会因缺字段把宿主搞崩。
// 运行：node scripts/host-smoke.mjs
import assert from 'node:assert/strict'

const mod = await import('../lib/index.js')

assert.equal(typeof mod.name, 'string')
assert.ok(['expert-role'].includes(mod.name))
assert.deepEqual(mod.inject, ['skills', 'tools', 'webServer', 'agents', 'systemPrompt'])
assert.equal(typeof mod.apply, 'function')

const seen = { providers: [], tools: [], routes: [], events: [], prompts: [] }

const ctx = {
  on(event, listener) {
    seen.events.push(event)
    assert.equal(typeof listener, 'function')
    return () => {}
  },
  effect(fn) {
    const dispose = fn()
    return typeof dispose === 'function' ? dispose : () => {}
  },
  skills: {
    registerProvider(create) {
      seen.providers.push(create)
      return () => {}
    },
  },
  tools: {
    register(definition) {
      assert.equal(typeof definition.name, 'string', 'tool.name 必须是字符串')
      assert.ok(definition.name.length > 0, 'tool.name 不能为空')
      assert.notEqual(definition.name, 'run_code', 'run_code 是保留名')
      assert.equal(typeof definition.description, 'string', 'tool.description 必须是字符串')
      assert.equal(definition.parameters?.type, 'object', `${definition.name}: parameters 根必须是 object`)
      assert.ok(definition.output && typeof definition.output === 'object', `${definition.name}: 缺 output`)
      assert.ok(definition.output.schema && typeof definition.output.schema === 'object', `${definition.name}: output.schema 缺失`)
      assert.equal(typeof definition.output.render, 'function', `${definition.name}: output.render 必须是函数`)
      assert.equal(typeof definition.execute, 'function', `${definition.name}: execute 必须是函数`)
      seen.tools.push(definition)
      return () => {}
    },
  },
  webServer: {
    register(route) {
      assert.equal(route.kind, 'exact', 'route.kind 必须是 exact')
      assert.match(route.path, /^\/expert-role\//, 'route.path 前缀应为 /expert-role/')
      assert.equal(typeof route.handler, 'function', 'route.handler 必须是函数')
      seen.routes.push(route)
      return () => {}
    },
  },
  systemPrompt: {
    section({ name, order, text }) {
      assert.equal(typeof name, 'string')
      assert.equal(typeof order, 'number')
      // 0.5.0 起 text 是函数（按调用方式动态返回），宿主允许 string 或 () => string。
      assert.ok(typeof text === 'string' || typeof text === 'function', 'text 应为字符串或函数')
      const resolved = typeof text === 'function' ? text() : text
      assert.equal(typeof resolved, 'string')
      seen.prompts.push({ name, order, text: resolved })
      return () => {}
    },
  },
  logger: () => ({ info() {}, warn() {}, error() {} }),
}

mod.apply(ctx, {})

assert.equal(seen.providers.length, 1, '应注册一个 skills provider')
assert.equal(seen.tools.length, 14, '应注册 14 个工具')
assert.equal(seen.routes.length, 18, '应注册 18 条路由（含检索、资料目录三条、建会话、会话动态、模型下载）')
assert.equal(seen.prompts.length, 1, '应注册 1 条静态系统提示词')
assert.match(seen.prompts[0].name, /^[a-z0-9-]+:[a-z0-9-]+$/, '提示词 name 应为 命名空间:名称')
assert.ok(seen.prompts[0].text.includes('lookup_expert_knowledge'), '提示词应点名查资料工具')
const names = seen.tools.map((tool) => tool.name)
assert.ok(names.includes('lookup_expert_knowledge'), '应注册 lookup_expert_knowledge')
assert.equal(new Set(names).size, names.length, '工具名不能重复')

// 模拟 DSH 的 provider 校验：name 必须存在且是 kebab-case
const control = { invalidate() {}, signal: new AbortController().signal }
const provider = seen.providers[0](control)
assert.equal(typeof provider.name, 'string', 'provider.name 缺失会让宿主崩溃')
assert.match(provider.name, /^[a-z0-9]+(-[a-z0-9]+)*$/, 'provider.name 必须是 kebab-case')
assert.equal(typeof provider.list, 'function')
assert.equal(typeof provider.get, 'function')

const candidates = await provider.list()
assert.ok(Array.isArray(candidates), 'provider.list 必须返回数组或 {candidates}')

const SKILL_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/
for (const candidate of candidates) {
  assert.match(candidate.name, SKILL_NAME, `candidate.name 非法：${candidate.name}`)
  assert.equal(typeof candidate.description, 'string', `${candidate.name}: 缺 description`)
  assert.ok(candidate.description.length > 0, `${candidate.name}: description 为空`)
  assert.equal(candidate.provider, provider.name, `${candidate.name}: provider 字段必须与 provider.name 一致`)
  assert.equal(typeof candidate.source, 'string')
  assert.equal(typeof candidate.rank, 'number')
  assert.equal(typeof candidate.invocation?.modelInvocable, 'boolean')
  assert.equal(candidate.locator?.path === candidate.path, true, `${candidate.name}: locator.path 与 path 应一致`)
  const definition = await provider.get(candidate)
  assert.equal(definition.name, candidate.name, `${candidate.name}: get() 返回的 name 必须与 candidate 相同`)
  assert.equal(typeof definition.content, 'string')
}

// 只实际执行只读工具；写类工具用假结果验证 render 不抛错
const byName = Object.fromEntries(seen.tools.map((tool) => [tool.name, tool]))
const listed = await byName.expert_list.execute({}, {})
assert.equal(typeof listed.text, 'string')
for (const tool of seen.tools) {
  assert.ok(Array.isArray(tool.output.render({}, { text: 'smoke' })), `${tool.name}: render 应返回数组`)
}

// 0.5.0 起不再用 turn-stopping + steer；只要求这两个监听
const required = ['agent/pre-step', 'tools/post-execute']
const missing = required.filter((name) => !seen.events.includes(name))
if (missing.length > 0) {
  console.error(`缺事件监听：${missing.join(', ')}`)
  process.exit(1)
}
console.log(
  JSON.stringify(
    {
      ok: true,
      provider: provider.name,
      experts: candidates.map((candidate) => ({ name: candidate.name, status: candidate.metadata?.status })),
      tools: seen.tools.map((tool) => tool.name),
      routes: seen.routes.map((route) => route.path),
    },
    null,
    2,
  ),
)
