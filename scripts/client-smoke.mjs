// 离线客户端冒烟：模拟 __ModuleLoader__，确认 client bundle 能导出 name/inject/apply，
// 且 apply() 只调用 slots 上存在的接口（左栏行 sidebar.panellist + 主区页 main）。
// 运行：node scripts/client-smoke.mjs
import assert from 'node:assert/strict'

let definition
globalThis.window = {
  __ModuleLoader__: {
    load(def) {
      definition = def
    },
  },
}

await import('../lib/client.js')
assert.ok(definition, '应调用 window.__ModuleLoader__.load')
assert.equal(definition.id, 'dsh-expert-role')
assert.equal(typeof definition.factory, 'function')

const React = {
  createElement: () => null,
  Fragment: {},
  useState: (value) => [value, () => {}],
  useEffect: () => {},
  useCallback: (fn) => fn,
}

const exportsObj = definition.factory((name) => {
  assert.equal(name, 'react', `未知的 require：${name}`)
  return React
})

assert.equal(exportsObj.name, 'dsh-expert-role')
assert.deepEqual(exportsObj.inject, ['slots'])
assert.equal(typeof exportsObj.apply, 'function')

const seen = []
const ctx = {
  effect(fn) {
    const dispose = fn()
    return typeof dispose === 'function' ? dispose : () => {}
  },
  slots: {
    inject(name, factory) {
      assert.ok(name === 'sidebar.panellist' || name === 'main', `未声明的插槽：${name}`)
      return factory()
    },
    register(spec, component) {
      assert.equal(typeof component, 'function')
      seen.push(spec)
      return () => {}
    },
  },
}

exportsObj.apply(ctx)

const row = seen.find((spec) => spec.name === 'sidebar.panellist')
const page = seen.find((spec) => spec.name === 'main')
assert.ok(row, '应注册左栏一行')
assert.equal(row.id, 'expert-library')
assert.equal(typeof row.label, 'function')
assert.equal(typeof row.label(), 'string')
assert.equal(typeof row.order, 'number')
assert.ok(page, '应注册主区一页')
assert.equal(page.key, 'expert-library')
assert.equal(seen.length, 2, '只应注册这两处')

console.log(JSON.stringify({ ok: true, row: row.id, page: page.key }, null, 2))
