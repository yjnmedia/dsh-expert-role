#!/usr/bin/env node
// expertctl —— 专家库的开发/自查入口。
// 设计原则：每个子命令都只读、幂等、可以反复跑；输出要么是人能读的表，要么是 JSON（--json）。
// 用法：
//   node scripts/expertctl.mjs doctor [--json]
//   node scripts/expertctl.mjs search "阅读器 行高"
//   node scripts/expertctl.mjs panel --tab 会话动态 --shot out.png
//   node scripts/expertctl.mjs session list
//   node scripts/expertctl.mjs log tail --n 5
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const pkgRoot = path.resolve(here, '..')

const TABS = ['概况', '资料', '调用记录', '设置', '自检', '会话动态', '空库', '大类']

function argOf(argv, name, fallback) {
  const i = argv.indexOf(name)
  if (i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--')) return argv[i + 1]
  const inline = argv.find((a) => a.startsWith(name + '='))
  return inline ? inline.slice(name.length + 1) : fallback
}

async function openLibrary() {
  const { resolveDataDirSync } = await import('../lib/datadir.js')
  const { ExpertLibrary } = await import('../lib/library.js')
  const resolved = resolveDataDirSync()
  if (!fs.existsSync(resolved.dir)) {
    console.error('资料目录不存在：' + resolved.dir + '（来源 ' + resolved.source + '）')
    process.exit(2)
  }
  return { root: resolved.dir, source: resolved.source, library: new ExpertLibrary(resolved.dir) }
}

async function cmdDoctor(argv) {
  const json = argv.includes('--json')
  const { root, source, library } = await openLibrary()
  const { readTaxonomy } = await import('../lib/taxonomy.js').catch(() => ({ readTaxonomy: null }))
  const { resolveDataDirSync } = await import('../lib/datadir.js')
  const problems = []
  const ids = (await library.listExpertIds()).slice().sort()

  // 1) 目录名 == manifest.id；资料都在 manifest.titles 与 index.md 里
  for (const id of ids) {
    const expert = await library.readExpert(id)
    if (!expert) {
      problems.push(id + '：读不到 manifest.json')
      continue
    }
    if (expert.id && expert.id !== id) problems.push(id + '：目录名与 manifest.id 不一致（' + expert.id + '）')
    const refDir = path.join(library.expertDir(id), 'references')
    if (!fs.existsSync(refDir)) continue
    const titles = expert.titles || {}
    const indexFile = path.join(refDir, 'index.md')
    const index = fs.existsSync(indexFile) ? fs.readFileSync(indexFile, 'utf8') : ''
    for (const entry of fs.readdirSync(refDir, { withFileTypes: true })) {
      if (entry.name === 'index.md' || entry.name === 'queries.md') continue
      let name = null
      if (entry.isFile() && entry.name.endsWith('.md')) name = entry.name
      if (entry.isDirectory() && fs.existsSync(path.join(refDir, entry.name, 'README.md'))) name = entry.name + '/'
      if (!name) continue
      const bare = name.replace(/\/$/, '')
      const inManifest = Object.keys(titles).some((k) => {
        const key = k.replace(/^references\//, '')
        return key === name || key === bare || key.startsWith(bare + '/')
      })
      if (!inManifest) problems.push(id + '：资料没进 manifest.titles → ' + name)
      if (!index.includes(name.replace(/\/$/, ''))) problems.push(id + '：资料没进 references/index.md → ' + name)
    }
  }

  // 2) taxonomy 八类与磁盘大类目录一一对应
  const taxoFile = path.join(pkgRoot, 'taxonomy.json')
  let categories = []
  if (fs.existsSync(taxoFile)) {
    const taxo = JSON.parse(fs.readFileSync(taxoFile, 'utf8'))
    categories = (taxo.categories || taxo.groups || []).map((c) => c.title || c.name).filter(Boolean)
  }
  const dirs = fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory() && /^\d{2}-/.test(e.name)).map((e) => e.name.replace(/^\d{2}-/, ''))
  for (const title of categories) {
    if (!dirs.includes(title)) problems.push('大类目录缺失：' + title)
  }
  for (const dir of dirs) {
    if (categories.length && !categories.includes(dir)) problems.push('磁盘多出大类目录：' + dir)
  }

  // 3) 面板状态顺序（与 test/panel-states.test.js 同一判据）
  const clientFile = path.join(pkgRoot, 'lib', 'client.js')
  const statesFile = path.join(pkgRoot, 'scripts', 'panel-states.mjs')
  if (fs.existsSync(clientFile) && fs.existsSync(statesFile)) {
    const { STATE_NAMES, statesFromClient } = await import('./panel-states.mjs')
    const actual = statesFromClient(fs.readFileSync(clientFile, 'utf8'))
    if (actual.join(',') !== STATE_NAMES.join(',')) {
      problems.push('面板状态顺序与 STATE_NAMES 不一致（client ' + actual.length + ' 个 / 登记 ' + STATE_NAMES.length + ' 个）')
    }
  }

  // 4) 工作区里只该有八个大类会话：多出来的都是越界新建的
  try {
    const home = process.env.DSH_HOME || path.join(process.env.USERPROFILE || process.env.HOME || '', '.dsh')
    const wsFile = path.join(home, 'storages', 'workspace.json')
    if (fs.existsSync(wsFile)) {
      const store = JSON.parse(fs.readFileSync(wsFile, 'utf8'))
      const table = store?.tables?.workspaces || {}
      const row = Object.values(table).find((item) => String(item?.path || '').replace(/\\/g, '/').toLowerCase() === root.replace(/\\/g, '/').toLowerCase())
      if (!row) {
        problems.push('工作区表里找不到这个资料目录：' + root)
      } else {
        const ids2 = Array.isArray(row.sessionIds) ? row.sessionIds : []
        const cats = ids2.filter((id) => /^session-expert-cat-0[1-8]$/.test(String(id)))
        const extra = ids2.filter((id) => !/^session-expert-cat-0[1-8]$/.test(String(id)))
        if (cats.length !== 8) problems.push('工作区里应有 8 个「大类会话」，现在 ' + cats.length + ' 个')
        if (extra.length) problems.push('工作区里多了不是大类的会话：' + extra.join('、'))
      }
    }
  } catch (error) {
    problems.push('读工作区登记失败：' + (error?.message ?? error))
  }

  const report = { root, source: resolveDataDirSync().source, experts: ids.length, categories: categories.length, problems }
  if (json) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    console.log('资料目录：' + root + '（来源 ' + report.source + '）')
    console.log('专家 ' + ids.length + ' 位，大类 ' + categories.length + ' 个')
    if (problems.length === 0) console.log('检查通过：目录、登记、大类、状态顺序都对得上。')
    else {
      console.log('发现 ' + problems.length + ' 个问题：')
      problems.forEach((p) => console.log('  - ' + p))
    }
  }
  process.exit(problems.length === 0 ? 0 : 1)
}

async function cmdSearch(argv) {
  const positional = argv.filter((a) => !a.startsWith('--'))
  const query = positional[0]
  if (!query) {
    console.error('用法：node scripts/expertctl.mjs search "要查的话"')
    process.exit(2)
  }
  const { root, library } = await openLibrary()
  const { createRetriever } = await import('../lib/retrieval.js')
  const { collectExperts } = await import('../lib/taxonomy.js').catch(() => ({ collectExperts: null }))
  const experts = collectExperts ? await collectExperts(library) : await Promise.all((await library.listExpertIds()).map((id) => library.readExpert(id)))
  const retriever = await createRetriever({ library, experts, cachePath: path.join(root, '.cache', 'docindex.json') })
  const result = await retriever.retrieve(query, { k: 5 })
  const ranked = result.top || []
  if (!ranked.length) {
    console.log('一份都没找到。库里没有和「' + query + '」对得上的资料。')
    return
  }
  ranked.slice(0, 5).forEach((hit, i) => {
    console.log((i + 1) + '. ' + hit.score.toFixed(3) + '  ' + hit.expert + '  ' + hit.title)
    console.log('   ' + path.join(library.expertDir(hit.expert), hit.rel))
  })
  if (result.uncertain) console.log('提示：' + (result.reason || '分差太小或分数偏低，这份结果不太确定。'))
}

async function cmdPanel(argv) {
  const tab = argOf(argv, '--tab', '概况')
  const shot = argOf(argv, '--shot', '')
  const index = TABS.indexOf(tab)
  if (index < 0) {
    console.error('没有这个页签：' + tab + '（可选：' + TABS.join(' / ') + '）')
    process.exit(2)
  }
  const out = path.resolve(shot || path.join(pkgRoot, '.tmp', 'panel-' + index + '.html'))
  fs.mkdirSync(path.dirname(out), { recursive: true })
  const htmlFile = out.endsWith('.png') ? out.replace(/\.png$/, '.html') : out
  execFileSync(process.execPath, [path.join(here, 'render-smoke.mjs')], {
    env: { ...process.env, DUMP_HTML: htmlFile, DUMP_TAB: String(index) },
    stdio: 'inherit',
  })
  console.log('HTML：' + htmlFile)
  if (out.endsWith('.png')) {
    const chrome = [
      'C:/Program Files/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    ].find((p) => fs.existsSync(p))
    if (!chrome) {
      console.error('没找到 Chrome，只能给你 HTML。')
      process.exit(0)
    }
    execFileSync(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=2', '--window-size=820,700', '--screenshot=' + path.resolve(out), 'file:///' + htmlFile.replace(/\\/g, '/')], { stdio: 'ignore' })
    console.log('截图：' + path.resolve(out))
  }
}

async function cmdSession(argv) {
  const action = argv.filter((a) => !a.startsWith('--'))[0] || 'list'
  if (action !== 'list') {
    console.error('session 只有 list：发消息要走面板或宿主接口（本命令只读）。')
    process.exit(2)
  }
  const { root } = await openLibrary()
  const dsh = (await import('../lib/datadir.js')).dshHome()
  const wsFile = path.join(dsh, 'storages', 'workspace.json')
  if (!fs.existsSync(wsFile)) {
    console.error('找不到工作区登记：' + wsFile)
    process.exit(2)
  }
  const ws = JSON.parse(fs.readFileSync(wsFile, 'utf8'))
  const list = Array.isArray(ws) ? ws : ws.workspaces || []
  const mine = list.filter((w) => String(w.path || '').toLowerCase() === root.toLowerCase())
  if (!mine.length) {
    console.log('这个目录还没登记成工作区：' + root)
    return
  }
  const ids = mine.flatMap((w) => w.sessionIds || [])
  console.log('工作区：' + root + '，会话 ' + ids.length + ' 个')
  ids.slice().sort().forEach((id) => console.log('  ' + id))
}

async function cmdLog(argv) {
  const n = Number(argOf(argv, '--n', '10')) || 10
  const { root } = await openLibrary()
  const { readSessionLog } = await import('../lib/session-log.js')
  const entries = await readSessionLog(root, { limit: n })
  if (!entries.length) {
    console.log('还没有记录。8 个大类会话跑过之后，这里会有历史。')
    return
  }
  for (const e of entries) {
    const t = new Date(e.ts).toLocaleString('zh-CN', { hour12: false })
    console.log(t + '  [' + (e.cat || '-') + ']  ' + (e.need ? '要你看·' + (e.needKind || '') : '不用你看'))
    console.log('  ' + String(e.text || '').replace(/\s+/g, ' ').slice(0, 120))
  }
}

const [cmd, ...rest] = process.argv.slice(2)
const commands = { doctor: cmdDoctor, search: cmdSearch, panel: cmdPanel, session: cmdSession, log: cmdLog }
if (!cmd || cmd === '--help' || cmd === '-h') {
  console.log('expertctl：专家库自查入口')
  console.log('  doctor                 目录、登记、大类、状态顺序一次查完')
  console.log('  search "问题"          照模型查资料的路径检索，看命中什么')
  console.log('  panel --tab 会话动态 --shot out.png   渲染面板并截图')
  console.log('  session list           列出这个工作区里的会话')
  console.log('  log tail --n 5         看会话动态最近几条')
  process.exit(cmd ? 0 : 2)
}
if (!commands[cmd]) {
  console.error('没有这个命令：' + cmd + '（用 --help 看全部）')
  process.exit(2)
}
await commands[cmd](rest)
