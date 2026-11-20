// 会话归属登记：DSH 侧栏只认工作区自己的 sessionIds。
// 会话文件头里没有 workspaceId，所以「会话文件在磁盘上」不等于「侧栏看得见」。
// 这里只做两件事：读登记表、算出该补哪几条；补登记的动作由调用方走 sessionController。

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { dshHome } from './datadir.js'

/** 八个大类会话的固定 id，和 research.js 的 CATEGORY_SESSIONS 保持一致。 */
export const CATEGORY_IDS = Array.from(
  { length: 8 },
  (_, i) => `session-expert-cat-${String(i + 1).padStart(2, '0')}`,
)

/** `C:\Users\x\.dsh` → 会话目录名前缀 `--C-Users-x-.dsh--` 里的每一段。 */
export function sessionDirName(root) {
  const normalized = String(root || '').replace(/[\\/]+/g, '-')
  return '--' + normalized.replace(/:/g, '-').replace(/-+/g, '-') + '--'
}

/** 读 `<DSH_HOME>/storages/workspace.json`，找出指向这个目录的工作区条目。 */
export function readWorkspaceEntry({ env, root }) {
  const file = join(dshHome(env), 'storages', 'workspace.json')
  let parsed
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return null
  }
  const table = parsed?.tables?.workspaces
  if (!table || typeof table !== 'object') return null
  const want = String(root || '').replace(/[\\/]+$/, '').toLowerCase()
  for (const [id, value] of Object.entries(table)) {
    const path = String(value?.path || '').replace(/[\\/]+$/, '').toLowerCase()
    if (path !== want) continue
    return {
      id,
      path: value?.path ?? '',
      sessionIds: Array.isArray(value?.sessionIds) ? value.sessionIds.map(String) : [],
    }
  }
  return null
}

/** 磁盘上确实存在会话目录的那些大类会话 id。 */
export function scanCategorySessionDirs({ env, root }) {
  const dir = join(dshHome(env), 'sessions', sessionDirName(root))
  let names = []
  try {
    names = readdirSync(dir)
  } catch {
    return []
  }
  const found = new Set(names)
  return CATEGORY_IDS.filter((id) => found.has(id))
}

/**
 * 算修复计划（纯函数，好测）：
 * - missingInRegistry：磁盘上有、登记表里没有 → 需要补登记
 * - missingOnDisk：登记表里有、磁盘上没有 → 补不了，只能报告
 * - unknown：两边都没有 → 还没建过，正常
 */
export function planSessionRepair({ sessionIds, present }) {
  const registered = new Set(Array.isArray(sessionIds) ? sessionIds.map(String) : [])
  const onDisk = new Set(Array.isArray(present) ? present.map(String) : [])
  const missingInRegistry = CATEGORY_IDS.filter((id) => onDisk.has(id) && !registered.has(id))
  const missingOnDisk = CATEGORY_IDS.filter((id) => registered.has(id) && !onDisk.has(id))
  const unknown = CATEGORY_IDS.filter((id) => !onDisk.has(id) && !registered.has(id))
  return {
    ok: missingInRegistry.length === 0 && missingOnDisk.length === 0,
    missingInRegistry,
    missingOnDisk,
    unknown,
  }
}

/** 读一遍现状，给启动自检和 doctor 用。 */
export function inspectSessions({ env, root }) {
  const entry = readWorkspaceEntry({ env, root })
  const present = scanCategorySessionDirs({ env, root })
  const plan = planSessionRepair({ sessionIds: entry?.sessionIds ?? [], present })
  return { workspace: entry, present, ...plan }
}
