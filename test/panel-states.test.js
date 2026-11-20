// 结构检查：Panel 里 useState 的调用顺序，必须和 scripts/panel-states.mjs 的登记完全一致。
// 目的：以前靠「记住第几位是哪个 state」，插一个 state 就让假状态整体错位，
// 表现为渲染到错误的页签（taxonomy 落进 error、sessionLog 漏一项）。
// 现在插队没登记，测试直接报「第几位多出来一个 state」。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { STATE_NAMES, statesFromClient } from '../scripts/panel-states.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const CLIENT = path.join(here, '..', 'lib', 'client.js')

// 把 `var stateDataDirInput = useState(...)` 变成 `dataDirInput`
function normalize(varName) {
  const bare = varName.replace(/^state/, '')
  return bare.charAt(0).toLowerCase() + bare.slice(1)
}

test('Panel 的 useState 顺序与 scripts/panel-states.mjs 登记一致', () => {
  const src = fs.readFileSync(CLIENT, 'utf8')
  assert.deepEqual(
    statesFromClient(src),
    STATE_NAMES,
    'Panel 的 useState 顺序变了：请同步 scripts/panel-states.mjs 的 STATE_NAMES（多出来的那个 state 会让渲染冒烟整体错位）',
  )
})
