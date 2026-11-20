// 缺口处置队列：面板上标了「回收 / 去查」之后，真正的执行发生在会话里。
// 这里只做排队、读取、完成三件事，不调用模型，避免面板点击直接花额度。
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'

export const PENDING_FILE = 'pending.json'

function fileOf(root) {
  return join(root, PENDING_FILE)
}

async function readAll(root) {
  try {
    const text = await readFile(fileOf(root), 'utf8')
    const data = JSON.parse(text)
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

async function writeAll(root, rows) {
  const file = fileOf(root)
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify(rows, null, 2) + '\n', 'utf8')
  return rows
}

export function pendingIdOf(item) {
  return `${item.expert}|${item.key}|${item.action}`
}

export async function addPending(root, item) {
  const rows = await readAll(root)
  const id = pendingIdOf(item)
  if (rows.some((row) => row.id === id && row.status === 'queued')) return rows
  rows.push({
    id,
    expert: item.expert,
    key: item.key,
    action: item.action,
    title: item.title ?? item.key,
    status: 'queued',
    at: new Date().toISOString(),
  })
  return writeAll(root, rows.slice(-200))
}

export async function listPending(root, status) {
  const rows = await readAll(root)
  return status ? rows.filter((row) => row.status === status) : rows
}

export async function finishPending(root, id) {
  const rows = await readAll(root)
  const hit = rows.filter((row) => row.id === id)[0]
  if (!hit) return { ok: false, error: `没有这条待办：${id}` }
  hit.status = 'done'
  hit.doneAt = new Date().toISOString()
  await writeAll(root, rows)
  return { ok: true, item: hit }
}
