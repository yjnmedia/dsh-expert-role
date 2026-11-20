#!/usr/bin/env node
// 缺口批量调研：一次一条、同类串行，跑完核对「补了几份、登记齐没齐」。
// 用法：node scripts/gap-batch.mjs --base http://127.0.0.1:59376 --expert ui-design --limit 5
// 停的条件：连续 3 条没补上资料、某条失败、或跑满 limit。

const args = process.argv.slice(2)
function arg(name, fallback = '') {
  const index = args.indexOf('--' + name)
  return index >= 0 ? String(args[index + 1] ?? fallback) : fallback
}

const base = arg('base', 'http://127.0.0.1:59376').replace(/\/$/, '')
const expert = arg('expert', 'ui-design')
const limit = Number(arg('limit', '5')) || 5
const skip = String(arg('skip', ''))
  .split('|')
  .map((item) => item.trim())
  .filter(Boolean)
const POLL_MS = 15000
const RUN_TIMEOUT_MS = 15 * 60 * 1000

async function get(path) {
  const response = await fetch(base + path)
  if (!response.ok) throw new Error(`${path} HTTP ${response.status}`)
  return response.json()
}

async function post(path, body) {
  const response = await fetch(base + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
  return response.json()
}

function stamp() {
  return new Date().toTimeString().slice(0, 8)
}

async function main() {
  const experts = await get('/expert-role/api/experts')
  const target = (experts.experts || []).find((item) => item.id === expert)
  if (!target) throw new Error(`没有这个专家：${expert}`)
  const gaps = (target.gaps || target.gapTopics || []).slice().sort((a, b) => (b.count || 0) - (a.count || 0))
  console.log(`[${stamp()}] ${expert} 待处理 ${gaps.length} 条；本次最多跑 ${limit} 条`)

  const rows = []
  let zeroStreak = 0
  let ran = 0
  for (const gap of gaps) {
    if (ran >= limit) break
    const key = String(gap.key || '')
    if (!key) continue
    if (skip.some((item) => key.includes(item))) {
      console.log(`[${stamp()}] 跳过（已判断不归这一类）：${key}`)
      continue
    }
    const before = await get('/expert-role/api/gap-research')
    const already = (before.runs || []).some((run) => run.expert === expert && run.key === key && run.status === 'done')
    if (already) {
      console.log(`[${stamp()}] 跳过（之前查过）：${key}`)
      continue
    }

    const started = Date.now()
    const start = await post('/expert-role/api/gap-research', { expert, key })
    if (start.error) {
      console.log(`[${stamp()}] 没能开跑：${start.error}`)
      rows.push({ key, status: 'error', note: start.error, seconds: 0, added: 0, registered: false })
      break
    }
    console.log(`[${stamp()}] 开跑（${start.sessionId}）：${key}`)

    let run = null
    for (;;) {
      await new Promise((resolve) => setTimeout(resolve, POLL_MS))
      const data = await get('/expert-role/api/gap-research')
      run = (data.runs || []).filter((item) => item.expert === expert && item.key === key).pop() || null
      const state = run?.status ?? 'missing'
      if (state !== 'running') break
      if (Date.now() - started > RUN_TIMEOUT_MS) {
        await post('/expert-role/api/gap-research/cancel', { expert, key, sessionId: start.sessionId })
        run = { status: 'failed', error: '超过 15 分钟没结束，已取消' }
        break
      }
    }

    const seconds = Math.round((Date.now() - started) / 1000)
    const added = Number(run?.added) || 0
    const registered = run?.registered === true
    const status = run?.status ?? 'unknown'
    console.log(
      `[${stamp()}] ${status} · ${seconds}s · 补 ${added} 份 · 登记${registered ? '齐' : '不齐'}` +
        (run?.error ? ` · ${run.error}` : ''),
    )
    rows.push({ key, status, seconds, added, registered, note: run?.diagnosis?.text || run?.error || '' })

    ran += 1
    zeroStreak = added > 0 ? 0 : zeroStreak + 1
    if (status === 'failed') {
      console.log('遇到失败，停下来等你看。')
      break
    }
    if (zeroStreak >= 3) {
      console.log('连续 3 条没补上资料，停下来等你定。')
      break
    }
  }

  console.log('\n=== 本次结果 ===')
  for (const row of rows) {
    console.log(`${row.status}\t${row.seconds}s\t补${row.added}\t登记${row.registered ? '齐' : '不齐'}\t${row.key}`)
  }
  console.log(JSON.stringify(rows))
}

main().catch((error) => {
  console.error('批量调研出错：', error.message)
  process.exit(1)
})
