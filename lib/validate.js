import { stat, readdir } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve } from 'node:path'

/**
 * 清单校验：只标不拦。
 * 目的不是拦下坏数据，而是把「清单里写了、磁盘上没有」「磁盘上有、清单里没登记」
 * 「链接到库外文件的路径已经失效」这些情况摆到面板上，让人自己决定要不要修。
 * 任何一项都不影响读取、检索、派发。
 */

const MAX_FILES = 400

async function exists(path) {
  return Boolean(await stat(path).catch(() => undefined))
}

async function walk(dir, root, depth = 0, out = []) {
  if (depth > 4 || out.length > MAX_FILES) return out
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    if (entry.name === '资料快捷方式' || entry.name === '_img') continue
    const abs = join(dir, entry.name)
    if (entry.isDirectory()) await walk(abs, root, depth + 1, out)
    else if (/\.(md|txt|json|ya?ml)$/i.test(entry.name)) out.push(relative(root, abs).replace(/\\/g, '/'))
  }
  return out
}

/** 一条资料在清单里的路径：相对（库内）或绝对（库外）。 */
function pathOf(root, rel) {
  return isAbsolute(rel) ? rel : resolve(root, rel)
}

/**
 * @returns {Promise<{issues: Array, counts: Record<string, number>}>}
 *   kind: missing-file（清单有、磁盘没）| unregistered（磁盘有、清单没）
 *         external-missing（库外链接失效）| empty（0 字节）
 */
export async function validateExpert(library, expert) {
  const root = join(library.expertDir(expert.id))
  const issues = []
  const registered = new Set()

  for (const topic of expert.topics ?? []) {
    for (const rel of topic.files ?? []) {
      const relKey = String(rel).replace(/\\/g, '/')
      registered.add(relKey)
      const abs = pathOf(root, relKey)
      const outside = isAbsolute(relKey)
      const found = await exists(abs)
      if (!found) {
        issues.push({
          kind: outside ? 'external-missing' : 'missing-file',
          path: relKey,
          topic: topic.title ?? topic.id,
          detail: outside ? '链接到库外的路径已经不存在了' : '清单里写了，但磁盘上找不到',
        })
        continue
      }
      const info = await stat(abs)
      if (!info.isDirectory() && info.size === 0) {
        issues.push({ kind: 'empty', path: relKey, topic: topic.title ?? topic.id, detail: '文件是空的（0 字节）' })
      }
    }
  }

  // 迁移后的资料是「一个目录一份资料」，清单登记的是目录本身；目录里的文件算已登记。
  const dirs = [...registered].filter((rel) => !/\.[a-z0-9]+$/i.test(rel))

  const onDisk = await walk(root, root)
  for (const rel of onDisk) {
    if (rel === 'SKILL.md' || rel === 'manifest.json' || rel === 'survey.md') continue
    if (rel.startsWith('workspace/')) continue
    if (rel.endsWith('/index.md') && rel.split('/').length === 2) continue
    if (rel === 'references/index.md' || rel === 'references/queries.md') continue
    if (rel === '资料对照.md') continue
    if (registered.has(rel)) continue
    if (registered.has(rel.replace(/\.md$/i, ''))) continue
    if (dirs.some((dir) => rel.startsWith(dir.replace(/\/$/, '') + '/'))) continue
    issues.push({ kind: 'unregistered', path: rel, detail: '磁盘上有这份资料，但清单里没登记' })
  }

  const counts = {}
  for (const issue of issues) counts[issue.kind] = (counts[issue.kind] ?? 0) + 1
  return { issues, counts }
}

const cache = new Map()
const CACHE_MS = 60_000

/** 带缓存：同一专家一分钟内不重复扫盘。 */
export async function issuesOf(library, expert) {
  const key = `${library.root}|${expert.id}|${expert.updatedAt ?? ''}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value
  const value = await validateExpert(library, expert)
  cache.set(key, { at: Date.now(), value })
  return value
}
