import { homedir } from 'node:os'
import { dirname, isAbsolute, join, parse, resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { access, cp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'

/**
 * 资料目录（专家库根）：默认 <DSH_HOME>/expert-role/experts，可换到任何盘。
 *
 * 解析顺序：环境变量 DSH_EXPERT_ROOT → 指针文件 <默认目录>/data-dir.json → 默认目录。
 * 指针放在默认目录里，是「数据搬走之后它还得找得到」：换到 D 盘后，默认目录只剩这一份小文件。
 * 参照 dsh-aifisher-canvas 的做法：写指针、重启生效、恢复默认只删指针不删数据。
 */

export const POINTER_NAME = 'data-dir.json'
export const OWNER_DIR = 'expert-role'
export const DATA_DIR_NAME = 'experts'

export function dshHome(env = process.env) {
  const explicit = String(env.DSH_HOME ?? '').trim()
  if (explicit) return resolve(explicit.replace(/^~(?=$|[\\/])/, homedir()))
  return join(homedir(), '.dsh')
}

export function defaultDataDir(env = process.env) {
  return join(dshHome(env), OWNER_DIR, DATA_DIR_NAME)
}

export function pointerPath(env = process.env) {
  return join(defaultDataDir(env), POINTER_NAME)
}

/** 目录能不能当资料目录：必须是绝对路径，不能是盘根，不能正好是 DSH 数据根。 */
export function isUsableDataDir(dir, env = process.env) {
  const text = String(dir ?? '').trim()
  if (!text) return { ok: false, reason: '路径是空的' }
  const target = resolve(text)
  if (!isAbsolute(target)) return { ok: false, reason: '要写完整路径（从盘符开始）' }
  if (target === parse(target).root) return { ok: false, reason: '不能直接放盘根，另建一个文件夹' }
  if (target === dshHome(env)) return { ok: false, reason: '不能正好是 DSH 自己的数据目录，另建一个文件夹' }
  if (dirname(target) === target) return { ok: false, reason: '不能直接放盘根' }
  return { ok: true, dir: target }
}

async function readPointer(env = process.env) {
  try {
    const raw = await readFile(pointerPath(env), 'utf8')
    const parsed = JSON.parse(raw)
    const dir = String(parsed?.directory ?? '').trim()
    if (!dir) return null
    return { directory: resolve(dir), savedAt: parsed?.savedAt ?? null }
  } catch {
    return null
  }
}

/**
 * 现在到底用哪个目录。
 * @returns {Promise<{dir:string, source:'env'|'pointer'|'default', defaultDir:string, pointer:string, pointerDir:string|null}>}
 */
export async function resolveDataDir(env = process.env) {
  const fallback = defaultDataDir(env)
  const pointer = await readPointer(env)
  const fromEnv = String(env.DSH_EXPERT_ROOT ?? '').trim()
  if (fromEnv) {
    return {
      dir: resolve(fromEnv),
      source: 'env',
      defaultDir: fallback,
      pointer: pointerPath(env),
      pointerDir: pointer?.directory ?? null,
    }
  }
  if (pointer) {
    const check = isUsableDataDir(pointer.directory, env)
    if (check.ok) {
      return {
        dir: check.dir,
        source: 'pointer',
        defaultDir: fallback,
        pointer: pointerPath(env),
        pointerDir: pointer.directory,
      }
    }
  }
  return {
    dir: fallback,
    source: 'default',
    defaultDir: fallback,
    pointer: pointerPath(env),
    pointerDir: pointer?.directory ?? null,
  }
}

/** 同步版：插件启动时就要拿到根目录，指针文件很小，直接读。 */
export function resolveDataDirSync(env = process.env) {
  const fallback = defaultDataDir(env)
  let pointerDir = null
  try {
    const parsed = JSON.parse(readFileSync(pointerPath(env), 'utf8'))
    const dir = String(parsed?.directory ?? '').trim()
    if (dir) pointerDir = resolve(dir)
  } catch {
    pointerDir = null
  }
  const fromEnv = String(env.DSH_EXPERT_ROOT ?? '').trim()
  if (fromEnv) return { dir: resolve(fromEnv), source: 'env', defaultDir: fallback, pointer: pointerPath(env), pointerDir }
  if (pointerDir) {
    const check = isUsableDataDir(pointerDir, env)
    if (check.ok) return { dir: check.dir, source: 'pointer', defaultDir: fallback, pointer: pointerPath(env), pointerDir }
  }
  return { dir: fallback, source: 'default', defaultDir: fallback, pointer: pointerPath(env), pointerDir }
}

async function exists(path) {  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function countEntries(dir) {
  try {
    const { readdir } = await import('node:fs/promises')
    return (await readdir(dir)).length
  } catch {
    return 0
  }
}

/**
 * 换资料目录：校验 → 建目录 →（可选）把现有资料复制过去 → 写指针。
 * 不删旧目录；指针要重启后才生效，调用方负责把这句话显示给用户。
 */
export async function setDataDir(dir, { copy = false, from = null, env = process.env } = {}) {
  const check = isUsableDataDir(dir, env)
  if (!check.ok) throw new Error(check.reason)
  const target = check.dir
  await mkdir(target, { recursive: true })

  let copied = 0
  if (copy && from && resolve(from) !== target && (await exists(from))) {
    await cp(from, target, { recursive: true, force: false, errorOnExist: false })
    copied = await countEntries(from)
  }

  const defaultDir = defaultDataDir(env)
  await mkdir(defaultDir, { recursive: true })
  const file = pointerPath(env)
  const temp = `${file}.tmp`
  await writeFile(temp, `${JSON.stringify({ directory: target, savedAt: new Date().toISOString() }, null, 2)}\n`, 'utf8')
  await rename(temp, file)

  return { dir: target, copied, pointer: file, restartRequired: true }
}

/** 恢复默认：只删指针，不删任何数据。 */
export async function resetDataDir(env = process.env) {
  const file = pointerPath(env)
  const had = await exists(file)
  if (had) await rm(file, { force: true })
  return { dir: defaultDataDir(env), cleared: had, restartRequired: true }
}

/** 目录现状（设置页第一行）：在用哪个、默认哪个、有没有改过、改过但还没生效。 */
export async function dataDirStatus({ env = process.env, activeDir = null } = {}) {
  const resolved = await resolveDataDir(env)
  const active = activeDir ? resolve(activeDir) : resolved.dir
  const pending = resolved.dir !== active
  const defaultExists = await exists(resolved.defaultDir)
  return {
    active,
    defaultDir: resolved.defaultDir,
    source: resolved.source,
    pointer: resolved.pointer,
    pointerDir: resolved.pointerDir,
    overridden: resolved.source !== 'default',
    pending,
    restartRequired: pending,
    defaultExists,
  }
}

/** 目录下有几个专家（含 SKILL.md 的子目录数），用来判断「这个库是不是已经在用了」。 */
export async function countExperts(dir) {
  try {
    const { readdir, stat } = await import('node:fs/promises')
    const names = await readdir(dir)
    let count = 0
    for (const name of names) {
      if (name.startsWith('.')) continue
      const full = join(dir, name)
      if (!(await exists(join(full, 'SKILL.md')))) continue
      const info = await stat(full).catch(() => null)
      if (info && info.isDirectory()) count += 1
    }
    return count
  } catch {
    return 0
  }
}

/** 盘符是不是 C（默认目录经常就落在 C，设置页要提醒用户换走）。 */
export function isSystemDrive(dir) {
  const root = parse(resolve(String(dir))).root
  return /^[a-zA-Z]:/.test(root) ? root[0].toLowerCase() === 'c' : false
}

/** 环境变量指定的位置也算候选，方便一台机器上长期固定某个盘。 */
export function envDataDir(env = process.env) {
  const raw = String(env.DSH_EXPERT_ROOT ?? '').trim()
  return raw ? resolve(raw) : null
}

/**
 * 列出机器上「看起来已经是资料库」的目录：默认目录、指针指向、历史位置。
 * 只读、不创建，专家数为 0 的候选不返回（避免把空目录当库推荐）。
 */
export async function listCandidates({ env = process.env, activeDir = null } = {}) {
  const resolved = await resolveDataDir(env)
  const seats = [
    { dir: resolved.defaultDir, kind: 'default' },
    { dir: resolved.pointerDir, kind: 'pointer' },
    { dir: envDataDir(env), kind: 'env' },
  ]
  if (activeDir) seats.push({ dir: activeDir, kind: 'active' })

  const seen = new Set()
  const out = []
  for (const seat of seats) {
    if (!seat.dir) continue
    const dir = resolve(String(seat.dir))
    if (seen.has(dir.toLowerCase())) continue
    seen.add(dir.toLowerCase())
    if (!(await exists(dir))) continue
    const experts = await countExperts(dir)
    if (!experts) continue
    out.push({ dir, kind: seat.kind, experts, systemDrive: isSystemDrive(dir) })
  }
  return out.sort((a, b) => b.experts - a.experts)
}

/**
 * 迁移：把现有库整体搬到新位置 → 写指针 →（用户选删时）删掉旧目录。
 * 删除前必须确认新位置已经拿到同样多的专家，否则报错且不动旧目录。
 */
export async function migrateDataDir(dir, { from, deleteOld = false, env = process.env } = {}) {
  const check = isUsableDataDir(dir, env)
  if (!check.ok) throw new Error(check.reason)
  const target = check.dir
  const source = from ? resolve(String(from)) : null
  if (!source || source === target) throw new Error('新位置和现在的位置一样，不用迁移')
  if (!(await exists(source))) throw new Error('现在的位置不存在，没东西可迁')

  await mkdir(target, { recursive: true })
  await cp(source, target, { recursive: true, force: false, errorOnExist: false })
  const before = await countExperts(source)
  const after = await countExperts(target)
  if (after < before) {
    throw new Error('复制不完整：旧位置 ' + before + ' 位专家，新位置只有 ' + after + ' 位，旧目录没删')
  }

  const defaultDir = defaultDataDir(env)
  await mkdir(defaultDir, { recursive: true })
  const file = pointerPath(env)
  const temp = file + '.tmp'
  await writeFile(temp, JSON.stringify({ directory: target, savedAt: new Date().toISOString() }, null, 2) + '\n', 'utf8')
  await rename(temp, file)

  let deleted = false
  if (deleteOld) {
    await rm(source, { recursive: true, force: true })
    deleted = !(await exists(source))
  }
  return { dir: target, moved: after, deleted, pointer: file, restartRequired: true }
}
