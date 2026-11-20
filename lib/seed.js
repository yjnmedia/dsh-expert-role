import { cp, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// 插件自带的两位专家（设计专家、插件专家），首次启动时复制进用户资料库。
export const BUNDLED_EXPERTS = ['guide', 'dsh-plugin']

const DEFAULT_BUNDLED_ROOT = fileURLToPath(new URL('../bundled/experts/', import.meta.url))

async function isDirectory(path) {
  try {
    return (await stat(path)).isDirectory()
  } catch {
    return false
  }
}

/**
 * 把 npm 包内 bundled/experts 下缺失的专家复制到资料库根目录。
 * 已存在的专家一律跳过，不覆盖用户资料。
 * @returns {Promise<string[]>} 本次实际复制进去的专家 id
 */
export async function seedBundledExperts(library, options = {}) {
  const bundledRoot = options.bundledRoot ?? DEFAULT_BUNDLED_ROOT
  const ids = options.ids ?? BUNDLED_EXPERTS
  const seeded = []
  if (!(await isDirectory(bundledRoot))) return seeded
  let available = []
  try {
    available = await readdir(bundledRoot)
  } catch {
    return seeded
  }
  await library.ensureRoot()
  for (const id of ids) {
    if (!available.includes(id)) continue
    const target = library.expertDir(id)
    if (await isDirectory(target)) continue
    await cp(join(bundledRoot, id), target, { recursive: true, force: false, errorOnExist: false })
    seeded.push(id)
  }
  return seeded
}
