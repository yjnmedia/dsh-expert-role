// 面板状态顺序：唯一事实来源。
// render-smoke 用它拼假的 useState 返回值；测试用它检查「有没有人偷偷插了一个 state 却没登记」。
// 顺序 = lib/client.js 里 Panel 组件 var stateX = useState(...) 的调用顺序。
export const STATE_NAMES = [
  'experts',
  'open',
  'trace',
  'files',
  'content',
  'stats',
  'audit',
  'tab',
  'cat',
  'error',
  'mode',
  'research',
  'lang',
  'reportMode',
  'fillMode',
  'fillSteps',
  'fillExperts',
  'gap',
  'modeBusy',
  'dataDir',
  'dataDirInput',
  'adoptWorkspace',
  'dataDirCopy',
  'dataDirBusy',
  'dataDirNote',
  'dataDirDeleteOld',
  'refreshing',
  'fade',
  'updatedAt',
  'loading',
  'taxonomy',
  'gapRuns',
  'sessionLog',
  'modelState',
  'modelBusy',
]

// 从「名字 → 值」的具名表拼出 useState 返回值数组，顺序由 STATE_NAMES 决定。
export function buildSeq(values) {
  const missing = STATE_NAMES.filter((name) => !(name in values))
  if (missing.length) throw new Error(`假状态缺这些名字：${missing.join('、')}`)
  return STATE_NAMES.map((name) => values[name])
}

// 从 client.js 源码里抽出 Panel 的 state 顺序（唯一定义，测试与 expertctl 共用）。
export function statesFromClient(source) {
  const lines = String(source).split(/\r?\n/)
  const startAt = lines.findIndex((l) => /var stateExperts = useState/.test(l))
  const endAt = lines.findIndex((l) => /var stateClock = useState/.test(l))
  if (startAt < 0 || endAt <= startAt) throw new Error('没找到 Panel 的 state 起止行（stateExperts / stateClock）')
  const names = []
  for (let i = startAt; i < endAt; i++) {
    const m = lines[i].match(/var (state\w+) = useState/)
    if (!m) continue
    const bare = m[1].replace(/^state/, '')
    names.push(bare.charAt(0).toLowerCase() + bare.slice(1))
  }
  return names
}
