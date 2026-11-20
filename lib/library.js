import { mkdir, readdir, readFile, writeFile, stat, appendFile } from 'node:fs/promises'
import { readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep, basename } from 'node:path'
import { homedir } from 'node:os'
import { maturityOf, clearMaturityCache, TIERS } from './maturity.js'

export const DEFAULT_ROOT = join(homedir(), 'AIExperts')
export const TRACE_DIR = '.trace'
export const TRACE_FILE = 'trace.jsonl'
const SKIP_DIRS = new Set([TRACE_DIR, 'models', '.cache'])
// 两级目录：库里先按大类分（01-平台与运行 … 08-专业技术），大类下才是专家目录。
const CATEGORY_DIR = /^\d{2}-/

/**
 * 每个专家被加载给模型时都会附上这段兜底说明（用 MISSING_GUIDE）。
 * 目的：库里没有对应资料时，模型必须停下来问用户，而不是拿自己的记忆硬编。
 */
export const MISSING_GUIDE = [
  '## 资料库没覆盖时',
  '',
  '1. 先在「按任务找资料」表里按任务找主题；表里没有，就调 `expert_find({ expert, query })` 搜一遍。',
  '2. `expert_find` 返回 `missing: true` 表示库里确实没有。这时停下来问用户，不要用模型自己的记忆硬编：',
  '   「现有资料库没有覆盖 <你要查的东西>。A：先用现有资料给近似答案，并注明缺什么；B：把这次结论整理成一份资料，用 expert_ingest 补进当前这个专家（不新建专家）。你要哪个？」',
  '3. 只有完全不属于现有任何专家职责时，才提议 `expert_create` 新建专家，且必须用户明确同意；只要属于当前专家范围，一律补资料，不新建。',
  '4. 用户选 B（补资料）时走 `expert_ingest({ expert, source })`，把这次的结论落成 `references/` 下的一份新资料。',
].join('\n')

/** 会话标题缓存位置：`~/.dsh/storages/session_projcache/sessions/<id>.json`。 */
const SESSION_CACHE_DIR = join(homedir(), '.dsh', 'storages', 'session_projcache', 'sessions')
// 会话 id 不只有 uuid：插件自己建的子会话是 session-expert-task-<uuid> / session-expert-<专家>-<ms>。
// 只做「安全标识符」校验，防止拿 id 拼路径时被 ../ 之类的窜出去。
const SESSION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/
const sessionTitleCache = new Map()

/**
 * 读某个会话的标题。只接受标准会话 id，读不到就返回空串。
 * 标题由 DSH 自己写在这份缓存里，本函数只读不改。
 */
export async function sessionTitleOf(id) {
  const sessionId = String(id ?? '')
  if (!SESSION_ID_PATTERN.test(sessionId)) return ''
  const file = join(SESSION_CACHE_DIR, `${sessionId}.json`)
  // 缓存放「改过没有」的判定依据：会话改名后文件 mtime 会变，这时必须重新读，
  // 否则面板会一直显示旧标题。
  let stamp = 0
  try {
    const info = await stat(file)
    stamp = Number(info.mtimeMs) || 0
  } catch {
    sessionTitleCache.delete(sessionId)
    return ''
  }
  const cached = sessionTitleCache.get(sessionId)
  if (cached && cached.stamp === stamp) return cached.title
  let title = ''
  try {
    const raw = await readFile(file, 'utf8')
    const parsed = JSON.parse(raw)
    title = String(parsed?.record?.rows?.title?.val ?? '').trim()
  } catch {
    title = ''
  }
  sessionTitleCache.set(sessionId, { stamp, title })
  return title
}

// 子会话（subagent）的归属：父会话的 subagentCatalog 里记着 childId，子会话自己只知道 label。
let parentIndexCache = { at: 0, map: new Map() }

async function parentIndexOf() {
  if (Date.now() - parentIndexCache.at < 120000) return parentIndexCache.map
  const map = new Map()
  let names = []
  try {
    names = await readdir(SESSION_CACHE_DIR)
  } catch {
    names = []
  }
  for (const name of names) {
    if (!name.endsWith('.json')) continue
    try {
      const raw = await readFile(join(SESSION_CACHE_DIR, name), 'utf8')
      const head = JSON.parse(raw)?.record?.rows?.subagentCatalog?.val?.head?.values
      if (!Array.isArray(head)) continue
      const parentId = name.slice(0, -5)
      for (const item of head) if (item?.childId) map.set(String(item.childId), parentId)
    } catch {
      /* 单个文件坏了就跳过 */
    }
  }
  parentIndexCache = { at: Date.now(), map }
  return map
}

/**
 * 会话的展示信息：标题、是否子会话、隶属哪个会话。
 * 子会话在 DSH 里是独立会话，但归属信息在父会话的 catalog 里，所以要反查。
 */
export async function sessionMetaOf(id) {
  const sessionId = String(id ?? '')
  if (!SESSION_ID_PATTERN.test(sessionId)) return { title: '', subagentLabel: '', parentTitle: '' }
  const title = await sessionTitleOf(sessionId)
  let subagentLabel = ''
  try {
    const raw = await readFile(join(SESSION_CACHE_DIR, `${sessionId}.json`), 'utf8')
    subagentLabel = String(JSON.parse(raw)?.record?.rows?.subagent?.val?.identity?.label ?? '').trim()
  } catch {
    subagentLabel = ''
  }
  if (!subagentLabel) return { title, subagentLabel: '', parentTitle: '' }
  const parents = await parentIndexOf()
  const parentId = parents.get(sessionId)
  const parentTitle = parentId ? await sessionTitleOf(parentId) : ''
  return { title, subagentLabel, parentTitle, parentId: parentId || '' }
}

/** 读取 SKILL.md 的简易 frontmatter（只支持 `key: value` 单行）。 */
export function parseFrontmatter(text) {
  const normalized = String(text ?? '').replace(/^\uFEFF/, '')
  if (!normalized.startsWith('---')) return { data: {}, body: normalized }
  const end = normalized.indexOf('\n---', 3)
  if (end < 0) return { data: {}, body: normalized }
  const head = normalized.slice(3, end)
  const body = normalized.slice(end + 4).replace(/^\s*\n/, '')
  const data = {}
  for (const rawLine of head.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const colon = line.indexOf(':')
    if (colon <= 0) continue
    const key = line.slice(0, colon).trim()
    let value = line.slice(colon + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    data[key] = value
  }
  return { data, body }
}

/** target 是否落在 root 之内（大小写不敏感，Windows）。 */
export function isInside(root, target) {
  const r = resolve(root).toLowerCase().replace(/[\\/]+$/, '')
  const t = resolve(target).toLowerCase()
  return t === r || t.startsWith(r + sep) || t.startsWith(r + '/')
}

// 技能名与简介的唯一规范来源：目录里每条技能只有 name + description 两个字段，
// 所以简介必须自带「管什么 + 什么时候用 + 有多少份」，不能指望 whenToUse 单独显示。
export const SKILL_DESCRIPTION_MAX = 480

export function skillDescription(expert) {
  // manifest 里显式写的 skillDescription 优先（总入口这种需要自定义措辞）。
  const custom = String(expert?.skillDescription ?? '').trim()
  if (custom) return custom.length <= SKILL_DESCRIPTION_MAX ? custom : `${custom.slice(0, SKILL_DESCRIPTION_MAX - 1)}…`
  const raw = String(expert?.title || expert?.id || '').trim() || '专家'
  // 标题本身已经带「资料库/专家库」时不再叠一层，避免「「XX资料库」资料库」。
  const title = raw.replace(/(资料库|专家库)$/u, '').trim() || raw
  const topics = (expert?.topics ?? []).map((item) => String(item?.title ?? '').trim()).filter(Boolean)
  const shown = topics.length > 5 ? `${topics.slice(0, 5).join('、')}等` : topics.join('、')
  const scope = shown || '本机调研结论'
  const when = String(expert?.whenToUse ?? '').trim()
    || `用户问「${title}」方向、要改相关项目、或想知道我们之前调研过什么时`
  const files = (expert?.topics ?? []).reduce((sum, item) => sum + (item?.files?.length ?? 0), 0)
  const tail = files > 0 ? `${files} 份资料，先查再答。` : ''
  const text = `「${title}」资料库：${scope}。用于：${when.replace(/[。.]+$/, '')}。${tail}`
  if (text.length <= SKILL_DESCRIPTION_MAX) return text
  return `${text.slice(0, SKILL_DESCRIPTION_MAX - 1)}…`
}

export function slugify(input) {
  const raw = String(input ?? '').trim().toLowerCase()
  const slug = raw.replace(/[^\p{Letter}\p{Number}]+/gu, '-').replace(/^-+|-+$/g, '')
  return slug || `expert-${Date.now()}`
}

function countDepth(rel) {
  return rel.split(/[\\/]+/).filter(Boolean).length
}

/**
 * 插件自己开的调研会话：派发子任务 session-expert-task-*、独立工作区 session-expert-<专家>-<毫秒>。
 * 这些会话是「造资料的人」，不是「用资料的人」，统计使用情况时要排除。
 */
export function isResearchSession(id) {
  const text = String(id || '')
  if (text.startsWith('session-expert-task-')) return true
  return /^session-expert-(?!task-).+-\d{10,}$/.test(text)
}

export class ExpertLibrary {
  constructor(root = DEFAULT_ROOT) {
    this.root = resolve(root)
    this._dirs = null
    this._dirsStamp = ''
  }

  /** 库根变动时间：目录改名/搬类之后重新扫，不靠重启。 */
  dirsStamp() {
    try {
      const info = statSync(this.root)
      return String(info.mtimeMs)
    } catch {
      return ''
    }
  }

  get tracePath() {
    return join(this.root, TRACE_DIR, TRACE_FILE)
  }

  /** 扫一遍库根：顶层的专家目录与「大类/专家」两级都收进 id→目录表。 */
  scanDirs() {
    const stamp = this.dirsStamp()
    // 光比时间戳不够：同一毫秒内「改名 / 搬类」会让 mtime 不变，缓存就会指着旧路径。
    // 所以命中缓存后还要逐个确证目录还在，少一个就重建（13 次 stat，比整树 readdir 便宜）。
    if (this._dirs && this._dirsStamp === stamp && this._dirsAllExist(this._dirs)) return this._dirs
    const map = new Map()
    let entries = []
    try {
      entries = readdirSync(this.root, { withFileTypes: true })
    } catch {
      this._dirs = map
      return map
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue
      if (CATEGORY_DIR.test(entry.name)) {
        let kids = []
        try {
          kids = readdirSync(join(this.root, entry.name), { withFileTypes: true })
        } catch {
          kids = []
        }
        for (const kid of kids) {
          if (!kid.isDirectory() || kid.name.startsWith('.') || kid.name === 'references') continue
          map.set(kid.name, join(this.root, entry.name, kid.name))
        }
        continue
      }
      map.set(entry.name, join(this.root, entry.name))
    }
    this._dirs = map
    this._dirsStamp = stamp
    return map
  }

  _dirsAllExist(dirs) {
    for (const dir of dirs.values()) {
      try {
        if (!statSync(dir).isDirectory()) return false
      } catch {
        return false
      }
    }
    return true
  }

  invalidateDirs() {
    this._dirs = null
    this._dirsStamp = ''
  }

  expertDir(id) {
    const map = this.scanDirs()
    return map.get(id) ?? join(this.root, id)
  }

  /** 专家目录相对库根的路径，读写都走它，兼容一级与两级。 */
  expertRel(id) {
    return relative(this.root, this.expertDir(id)).split(sep).join('/')
  }

  /** 所有对外文件路径都过这一层，越界直接抛错。 */
  resolveIn(root, rel) {
    if (typeof rel !== 'string' || rel.length === 0) throw new Error('path 不能为空')
    if (/^[a-zA-Z]:/.test(rel) || rel.startsWith('\\\\') || rel.startsWith('/')) {
      throw new Error(`只接受相对路径：${rel}`)
    }
    const abs = resolve(root, rel)
    if (!isInside(this.root, abs)) throw new Error(`路径越界：${rel}`)
    return abs
  }

  async ensureRoot() {
    await mkdir(this.root, { recursive: true })
    await mkdir(join(this.root, TRACE_DIR), { recursive: true })
    return this.root
  }

  async readJson(rel, fallback) {
    try {
      const abs = this.resolveIn(this.root, rel)
      return JSON.parse(await readFile(abs, 'utf8'))
    } catch {
      return fallback
    }
  }

  /** 记住（或清空）工作区档复用的那个会话 id。 */
  async setWorkspaceSession(id, sessionId) {
    const expert = await this.readExpert(id)
    expert.workspaceSessionId = sessionId || undefined
    await this.writeJson(join(this.expertRel(id), 'manifest.json'), renderManifest(expert))
    try { clearMaturityCache() } catch { /* 清缓存失败不影响写入 */ }
    return expert.workspaceSessionId
  }

  async writeJson(rel, value) {
    const abs = this.resolveIn(this.root, rel)
    await mkdir(dirname(abs), { recursive: true })
    await writeFile(abs, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
    return abs
  }

  async readText(rel) {
    const abs = this.resolveIn(this.root, rel)
    return readFile(abs, 'utf8')
  }

  async writeText(rel, content) {
    const abs = this.resolveIn(this.root, rel)
    await mkdir(dirname(abs), { recursive: true })
    await writeFile(abs, String(content ?? ''), 'utf8')
    return abs
  }

  async listExpertIds() {
    await this.ensureRoot()
    return [...this.scanDirs().keys()].sort()
  }

  async readExpert(id, options = {}) {
    const dir = this.expertDir(id)
    const rel = this.expertRel(id)
    const manifest = await this.readJson(join(rel, 'manifest.json'), {})
    let frontmatter = {}
    let body = ''
    try {
      const parsed = parseFrontmatter(await readFile(join(dir, 'SKILL.md'), 'utf8'))
      frontmatter = parsed.data
      body = parsed.body
    } catch {
      /* 还没有 SKILL.md 的专家允许存在 */
    }
    const survey = await this.readSurvey(id)
    const expert = {
      id,
      dir,
      title: manifest.title ?? frontmatter.title ?? id,
      description: manifest.description ?? frontmatter.description ?? '',
      whenToUse: frontmatter['when-to-use'] ?? manifest.whenToUse ?? '',
      skillDescription: typeof manifest.skillDescription === 'string' ? manifest.skillDescription : '',
      summaries: manifest.summaries && typeof manifest.summaries === 'object' ? manifest.summaries : {},
      sources: Array.isArray(manifest.sources) ? manifest.sources : [],
      queries: manifest.queries && typeof manifest.queries === 'object' ? manifest.queries : {},
      triggerWords: Array.isArray(manifest.triggerWords) ? manifest.triggerWords.map(String) : [],
      skillName: frontmatter.name ?? `expert-${id}`,
      mode: manifest.mode ?? survey.mode ?? 'serial',
      status: manifest.status ?? 'draft',
      updatedAt: manifest.updatedAt ?? '',
      topics: Array.isArray(manifest.topics) ? manifest.topics : [],
      titles: manifest.titles && typeof manifest.titles === 'object' ? manifest.titles : {},
      reviews: manifest.reviews && typeof manifest.reviews === 'object' ? manifest.reviews : {},
      workspaceSessionId: typeof manifest.workspaceSessionId === 'string' ? manifest.workspaceSessionId : undefined,
      hasSkill: Object.keys(frontmatter).length > 0,
      // expose='none' 的专家不注册成技能，只作为资料目录存在（入口技能统一代替它做广告）。
      expose: manifest.expose === 'none' ? 'none' : 'skill',
      // router 是总入口：负责把问题路由给各专家，自己不存资料，面板不把它算作一位专家。
      role: manifest.role === 'router' ? 'router' : 'expert',
      // 学科层级：L1 大类 / L2 二级，用来在检索时收窄候选（可缺省）。
      level1: typeof manifest.level1 === 'string' ? manifest.level1 : '',
      level2: typeof manifest.level2 === 'string' ? manifest.level2 : '',
      body,
      survey,
    }
    const trace = options.trace ?? (await this.traceTail(5000).catch(() => []))
    const maturity = await maturityOf(this, expert, trace)
    expert.maturity = maturity
    expert.stage = maturity.tier
    expert.stars = '★'.repeat(maturity.level) + '☆'.repeat(Math.max(0, 5 - maturity.level))
    expert.stageHint = maturity.hint
    expert.stageLevel = maturity.level
    return expert
  }

  async listExperts(options = {}) {
    const ids = await this.listExpertIds()
    const trace = options.trace ?? (await this.traceTail(5000).catch(() => []))
    const experts = []
    for (const id of ids) experts.push(await this.readExpert(id, { trace }))
    return experts
  }

  async readSurvey(id) {
    const text = await this.readText(join(this.expertRel(id), 'survey.md')).catch(() => '')
    return parseSurvey(text)
  }

  /** 只改传进来的那几项，其余沿用 survey.md 现状。 */
  async updateSurvey(id, patch = {}) {
    const expert = await this.readExpert(id)
    const current = expert.survey
    const next = {
      title: patch.title ?? `${expert.title} · 尽调计划`,
      goal: patch.goal ?? current.goal,
      mode: patch.mode ?? current.mode,
      steps: patch.steps ?? current.steps,
      records: patch.records ?? current.records,
    }
    await this.writeText(join(this.expertRel(id), 'survey.md'), renderSurvey(next))
    return next
  }

  /** 递归列出专家目录下的文件（深度 ≤ 4，跳过 .trace）。 */
  async listFiles(id) {
    const base = this.expertDir(id)
    const out = []
    const walk = async (dir, depth) => {
      if (depth > 4) return
      const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === '资料快捷方式') continue
        if (/\.lnk$/i.test(entry.name)) continue
        const abs = join(dir, entry.name)
        if (entry.isDirectory()) {
          await walk(abs, depth + 1)
          continue
        }
        const info = await stat(abs).catch(() => undefined)
        out.push({
          path: relative(this.root, abs).split(sep).join('/'),
          name: entry.name,
          bytes: info?.size ?? 0,
          updatedAt: info?.mtime?.toISOString() ?? '',
        })
      }
    }
    await walk(base, 0)
    out.sort((a, b) => a.path.localeCompare(b.path))
    return out
  }

  async appendTrace(entry) {
    await this.ensureRoot()
    const line = JSON.stringify({ ts: new Date().toISOString(), ...entry })
    await appendFile(this.tracePath, `${line}\n`, 'utf8')
    return line
  }

  async sessionMeta(id) {
    return sessionMetaOf(id)
  }

  async traceTail(limit = 200) {
    const text = await readFile(this.tracePath, 'utf8').catch(() => '')
    const lines = text.split(/\r?\n/).filter(Boolean)
    const slice = lines.slice(Math.max(0, lines.length - limit))
    return slice.map((line) => {
      try {
        return JSON.parse(line)
      } catch {
        return { ts: '', kind: 'raw', text: line }
      }
    })
  }

  /** 统计某个专家被多少个不同会话用过；按 trace 文件 mtime 缓存，避免每个专家都全量扫。 */
  async usageOf(id) {
    const info = await stat(this.tracePath).catch(() => null)
    if (!info) return { sessions: 0 }
    const key = `${info.mtimeMs}:${info.size}`
    if (this._usageKey !== key || !this._usageSessions) {
      const entries = await this.traceTail(5000)
      const map = new Map()
      for (const entry of entries) {
        if (!entry || !entry.expert || !entry.session) continue
        if (isResearchSession(entry.session)) continue
        if (!map.has(entry.expert)) map.set(entry.expert, new Set())
        const uuid = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(String(entry.session))
        map.get(entry.expert).add(entry.sessionUuid || (uuid ? uuid[1].toLowerCase() : entry.session))
      }
      this._usageSessions = map
      this._usageKey = key
    }
    return { sessions: (this._usageSessions.get(id) || new Set()).size }
  }

  async expertOfPath(absPath) {
    if (!isInside(this.root, absPath)) return undefined
    const rel = relative(this.root, absPath).split(sep)
    if (rel.length === 0 || rel[0] === TRACE_DIR || rel[0].startsWith('.')) return undefined
    return rel[0]
  }
}

/** survey.md 的极简结构：`## 目标`、`## 步骤`（`- [x] 1. ...`）、`## 进度记录`。 */
export function parseSurvey(text) {
  const lines = String(text ?? '').split(/\r?\n/)
  const result = { goal: '', mode: 'serial', steps: [], records: [], raw: String(text ?? '') }
  let section = ''
  for (const line of lines) {
    const heading = /^##\s+(.+)$/.exec(line.trim())
    if (heading) {
      section = heading[1].trim()
      continue
    }
    if (section === '目标' && line.trim()) result.goal = line.trim()
    if (section === '步骤') {
      const step = /^\s*-\s*\[( |x|X)\]\s*(\d+)[.、]\s*(.+)$/.exec(line)
      if (step) result.steps.push({ index: Number(step[2]), done: step[1].toLowerCase() === 'x', text: step[3].trim() })
    }
    if (section === '进度记录' && line.trim().startsWith('|')) {
      const cells = line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim())
      if (cells.length >= 3 && !/^-+$/.test(cells[0]) && cells[0] !== '步骤') {
        result.records.push({ step: cells[0], status: cells[1], note: cells[2], at: cells[3] ?? '' })
      }
    }
  }
  const modeLine = /^mode:\s*(\S+)/m.exec(result.raw)
  if (modeLine) result.mode = modeLine[1]
  return result
}

export function renderSurvey({ title, goal, mode, steps, records }) {
  const lines = [`# ${title || '尽调计划'}`, '', `mode: ${mode || 'serial'}`, '', '## 目标', '', goal || '（待填写）', '', '## 步骤', '']
  steps.forEach((step, index) => {
    lines.push(`- [${step.done ? 'x' : ' '}] ${index + 1}. ${step.text}`)
  })
  lines.push('', '## 进度记录', '', '| 步骤 | 状态 | 结论 | 时间 |', '|---|---|---|---|')
  for (const record of records) {
    lines.push(`| ${record.step} | ${record.status} | ${String(record.note ?? record.summary ?? '').replace(/\|/g, '/').replace(/\s+/g, ' ').trim()} | ${record.at ?? ''} |`)
  }
  lines.push('')
  return lines.join('\n')
}

/**
 * 阶段：起步 / 可用 / 可靠 / 权威 / 标杆，由 lib/maturity.js 算出来。
 * 这里保留同名导出，供旧调用方（index.md 生成、测试）读取档名与星级。
 */
export const STAGES = TIERS

export function stageInfoOf(expert, usage = {}) {
  const maturity = expert?.maturity
  if (maturity && maturity.tier) {
    const level = maturity.level
    return {
      level: maturity.tier,
      stars: '★'.repeat(level) + '☆'.repeat(Math.max(0, 5 - level)),
      index: level,
      hint: maturity.hint,
    }
  }
  const sessions = Number(usage?.sessions || 0)
  const parts = [`${expert?.topics?.length ?? 0} 个主题`, `${expert?.maturity?.materials ?? 0} 份资料`]
  if (sessions > 0) parts.push(`${sessions} 个会话用过`)
  return { level: '起步', stars: '★☆☆☆☆', index: 1, hint: parts.join(' · ') }
}

export function stageOf(expert, usage = {}) {
  return stageInfoOf(expert, usage).level
}

export function renderManifest(expert) {
  const manifest = {
    id: expert.id,
    title: expert.title,
    description: expert.description,
    mode: expert.mode,
    status: expert.status ?? 'draft',
    updatedAt: new Date().toISOString(),
  }
  // topics 是后加的字段，写回时必须保留，否则 expert_plan/mode/record 一次就把主题表抹掉。
  if (Array.isArray(expert.topics) && expert.topics.length > 0) manifest.topics = expert.topics
  // 同上：titles / reviews 也是后加字段，写回时丢掉会让面板和新鲜度打分失忆。
  if (expert.titles && Object.keys(expert.titles).length > 0) manifest.titles = expert.titles
  if (expert.reviews && Object.keys(expert.reviews).length > 0) manifest.reviews = expert.reviews
  // 工作区档要复用它开的那个会话，否则每查一份资料就会多出一个会话。
  if (expert.expose === 'none') manifest.expose = 'none'
  if (expert.role === 'router') manifest.role = 'router'
  if (expert.skillDescription) manifest.skillDescription = expert.skillDescription
  if (expert.summaries && Object.keys(expert.summaries).length) manifest.summaries = expert.summaries
  if (Array.isArray(expert.sources) && expert.sources.length) manifest.sources = expert.sources
  if (expert.queries && Object.keys(expert.queries).length) manifest.queries = expert.queries
  if (expert.titles && Object.keys(expert.titles).length) manifest.titles = expert.titles
  if (expert.triggerWords?.length) manifest.triggerWords = expert.triggerWords
  if (expert.workspaceSessionId) manifest.workspaceSessionId = expert.workspaceSessionId
  if (expert.level1) manifest.level1 = expert.level1
  if (expert.level2) manifest.level2 = expert.level2
  return manifest
}

export async function main() {
  /* 供手动调试：node lib/library.js list */
  const lib = new ExpertLibrary(process.argv[3] ?? DEFAULT_ROOT)
  const experts = await lib.listExperts()
  for (const expert of experts) console.log(`${expert.id}\t${expert.status}\t${expert.title}`)
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
