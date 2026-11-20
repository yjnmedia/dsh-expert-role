import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = fileURLToPath(new URL('.', import.meta.url))
export const DEFAULT_TAXONOMY_PATH = join(HERE, '..', 'taxonomy.json')

let cachedDefault = null
let cachedStamp = null

async function readJson(path) {
  const text = await readFile(path, 'utf8')
  return JSON.parse(text)
}

// 优先读库根自己的 taxonomy.json，没有就用插件自带的默认值。
function stampOf(stats) {
  return stats ? String(stats.mtimeMs) + ':' + String(stats.size) : 'none'
}

export async function loadTaxonomy(libraryRoot) {
  if (libraryRoot) {
    try {
      const local = await readJson(join(libraryRoot, 'taxonomy.json'))
      if (Array.isArray(local?.groups) && local.groups.length) return normalize(local)
    } catch {
      // 本地没有或坏了，退回默认
    }
  }
  try {
    const info = await stat(DEFAULT_TAXONOMY_PATH)
    const stamp = stampOf(info)
    if (!cachedDefault || cachedStamp !== stamp) {
      cachedDefault = normalize(await readJson(DEFAULT_TAXONOMY_PATH))
      cachedStamp = stamp
    }
  } catch {
    if (!cachedDefault) cachedDefault = { groups: [] }
  }
  return cachedDefault
}

export function normalize(raw) {
  const groups = (raw.groups || [])
    .filter((item) => item && item.id && item.title)
    .map((item, index) => ({
      id: String(item.id),
      title: String(item.title),
      desc: String(item.desc || ''),
      order: Number.isFinite(item.order) ? item.order : index + 1,
    }))
  groups.sort((a, b) => a.order - b.order)
  return { groups }
}

// 按分类统计专家数量；没有专家的类目也返回，面板据此显示「待填」。
export function groupExperts(experts, taxonomy) {
  const list = experts || []
  const groups = (taxonomy?.groups || []).map((group) => {
    const members = list.filter((expert) => expert.level1 === group.title)
    return { ...group, count: members.length, experts: members.map((expert) => ({ id: expert.id, title: expert.title })) }
  })
  const known = new Set(groups.map((group) => group.title))
  const rest = list.filter((expert) => !known.has(expert.level1))
  if (rest.length) {
    const misc = groups.find((group) => group.id === 'misc')
    if (misc) {
      misc.count += rest.length
      misc.experts = misc.experts.concat(rest.map((expert) => ({ id: expert.id, title: expert.title })))
    }
  }
  return groups
}
