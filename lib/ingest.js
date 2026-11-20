import { mkdir, readFile, readdir, rename, stat } from 'node:fs/promises'
import { basename, join, relative, resolve, sep } from 'node:path'

/** 目录里优先读这几份；都没有就取第一个 .md。 */
const PREFERRED = ['README.md', '调研报告.md', '结论.md', 'index.md']

/** 从正文里抠出可以给人看的标题、什么时候用、一句话结论。 */
export function inferMeta(text, fallbackTitle) {
  const lines = String(text || '').split(/\r?\n/)
  const heading = lines.find((line) => /^#\s+\S/.test(line))
  const title = heading ? heading.replace(/^#\s+/, '').trim() : fallbackTitle

  const paragraphs = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('|') || trimmed.startsWith('```')) continue
    paragraphs.push(trimmed)
    if (paragraphs.length >= 3) break
  }
  const first = paragraphs[0] || ''
  const sentence = (first.split(/(?<=[。！？!?])/)[0] || first).replace(/[*`]/g, '').trim()
  const useWhen = `涉及「${title}」时先读这份资料`
  const summary = (sentence || title).slice(0, 120)
  return { title, useWhen, summary }
}

async function firstReadableFile(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = entries.filter((entry) => entry.isFile() && /\.md$/i.test(entry.name)).map((entry) => entry.name)
  for (const name of PREFERRED) {
    const hit = files.find((file) => file.toLowerCase() === name.toLowerCase())
    if (hit) return join(dir, hit)
  }
  if (files.length > 0) return join(dir, files[0])
  const subdirs = entries.filter((entry) => entry.isDirectory())
  for (const sub of subdirs) {
    const found = await firstReadableFile(join(dir, sub.name)).catch(() => undefined)
    if (found) return found
  }
  return undefined
}


/** 英文目录名：只留 ASCII 字母数字与连字符；中文标题没法直译，就用专家+序号兜底。 */
export function asciiSlug(text, fallback) {
  const slug = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  if (slug) return slug
  return fallback
}

function samePath(a, b) {
  return resolve(a).toLowerCase() === resolve(b).toLowerCase()
}

/** 把一行塞进 index.md 对应主题的表格；没有这个主题就在文末新开一节。 */
export function addIndexRow(text, topicTitle, name, path, oneLiner) {
  const row = `| ${name} | \`${path}\` | ${oneLiner} |`
  const lines = String(text || '').split(/\r?\n/)
  const headingIndex = lines.findIndex(
    (line) => /^##\s+/.test(line) && line.replace(/^##\s+/, '').trim() === topicTitle.trim(),
  )
  if (headingIndex === -1) {
    const tail = lines.join('\n').replace(/\s+$/, '')
    return `${tail}\n\n## ${topicTitle}\n\n| 资料 | 路径 | 一句话 |\n|---|---|---|\n${row}\n`
  }
  let lastTableLine = -1
  let index = headingIndex + 1
  while (index < lines.length && !/^##\s+/.test(lines[index])) {
    if (/^\|/.test(lines[index].trim())) lastTableLine = index
    index += 1
  }
  if (lastTableLine === -1) {
    lines.splice(headingIndex + 1, 0, '', '| 资料 | 路径 | 一句话 |', '|---|---|---|', row)
  } else {
    lines.splice(lastTableLine + 1, 0, row)
  }
  return lines.join('\n')
}

/**
 * 把一份资料（目录或文件）搬进专家库并登记：移动原文，不留副本。
 * 只强制专家存在、路径能读；其余字段都能推断，推断出来的记在 manifest.autoEntries 里。
 */
export async function ingestSource(library, input = {}) {
  const expertId = String(input.expert || '').trim()
  const ids = await library.listExpertIds()
  if (!ids.includes(expertId)) throw new Error(`专家不存在：${expertId}`)

  const source = String(input.source || '').trim()
  if (!source) throw new Error('需要 source：要登记的资料目录或文件路径')

  const absolute = resolve(library.root, source)
  const info = await stat(absolute).catch(() => undefined)
  if (!info) throw new Error(`读不到这份资料：${absolute}`)

  const isDir = info.isDirectory()
  let file
  if (isDir) {
    file = await firstReadableFile(absolute).catch(() => undefined)
    if (!file) throw new Error(`这个目录里没有可读的 .md：${absolute}`)
  } else {
    file = absolute
  }
  const text = await readFile(file, 'utf8').catch(() => undefined)
  if (text === undefined) throw new Error(`读不到这份资料：${file}`)

  const inferred = inferMeta(text, basename(absolute))
  const title = String(input.title || '').trim() || inferred.title
  const useWhen = String(input.useWhen || '').trim() || inferred.useWhen
  const summary = String(input.summary || '').trim() || inferred.summary
  const autoFields = []
  if (!String(input.title || '').trim()) autoFields.push('title')
  if (!String(input.useWhen || '').trim()) autoFields.push('useWhen')
  if (!String(input.summary || '').trim()) autoFields.push('summary')

  const expertRoot = library.expertDir(expertId)
  const slugBase = String(input.slug || '').trim() || (isDir ? basename(absolute) : basename(absolute, '.md'))
  const slug = asciiSlug(String(input.slug || title || slugBase), `material-${Date.now().toString(36)}`)
  const destName = isDir ? slug : `${slug}.md`
  const dest = join(expertRoot, 'references', destName)

  const alreadyInside = resolve(absolute).toLowerCase().startsWith(resolve(expertRoot).toLowerCase() + sep.toLowerCase())
  let placed = absolute
  if (!alreadyInside) {
    await mkdir(join(expertRoot, 'references'), { recursive: true })
    const free = await stat(dest).catch(() => undefined)
    const finalDest = free ? `${dest}-${Date.now().toString(36)}` : dest
    await rename(absolute, finalDest)
    placed = finalDest
  }
  const rel = relative(expertRoot, placed).split(sep).join('/')

  const manifestPath = `${expertId}/manifest.json`
  const manifest = await library.readJson(manifestPath)
  if (!Array.isArray(manifest.topics)) manifest.topics = []

  const wanted = String(input.topic || '').trim()
  let topic = wanted
    ? manifest.topics.find(
        (item) => item.id.toLowerCase() === wanted.toLowerCase() || item.title.trim() === wanted,
      )
    : undefined
  if (!topic) {
    const id = (wanted || 'unfiled').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5-]+/g, '-').replace(/^-+|-+$/g, '')
    topic = { id: id || 'unfiled', title: wanted || '未归类', whenToUse: useWhen, files: [] }
    manifest.topics.push(topic)
  }
  if (!Array.isArray(topic.files)) topic.files = []
  const existed = topic.files.some((item) => samePath(item, rel) || samePath(item, placed))
  if (!existed) topic.files.push(rel)
  manifest.titles = manifest.titles || {}
  manifest.titles[rel] = title
  manifest.reviews = manifest.reviews || {}
  manifest.reviews[rel] = { reviewedAt: new Date().toISOString(), by: 'ingest' }

  manifest.updatedAt = new Date().toISOString()
  const autoEntries = Array.isArray(manifest.autoEntries) ? manifest.autoEntries : []
  if (autoFields.length > 0) {
    const record = autoEntries.find((item) => samePath(item.path, rel))
    const fields = new Set([...(record?.fields || []), ...autoFields])
    if (record) record.fields = [...fields]
    else autoEntries.push({ path: rel, fields: [...fields], at: manifest.updatedAt })
  }
  manifest.autoEntries = autoEntries
  await library.writeJson(manifestPath, manifest)

  const indexPath = `${expertId}/references/index.md`
  const indexText = await library.readText(indexPath).catch(() => `# ${expertId} · 资料索引\n`)
  if (!indexText.includes(rel)) {
    const oneLiner = autoFields.length > 0 ? `${summary}（自动推断，可改）` : summary
    await library.writeText(indexPath, addIndexRow(indexText, topic.title, title, rel, oneLiner))
  }

  return {
    expert: expertId,
    path: rel,
    absolute: placed,
    moved: placed !== absolute,
    topic: topic.title,
    title,
    useWhen,
    summary,
    autoFields,
    existed,
  }
}
