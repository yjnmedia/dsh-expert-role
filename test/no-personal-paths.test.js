import { readdir, readFile } from 'node:fs/promises'
import { join, extname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

// 公开仓库不许出现本机痕迹：个人路径、会话号、请求号、内部项目名、内部库路径。
// 这条规则是「从犯错长出来的」——上一版公开包里带了几十个个人绝对路径。
const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SKIP = new Set(['node_modules', '.git', '.tmp', '.trace', '.cache', 'models'])
const TEXT = new Set(['.js', '.mjs', '.json', '.md', '.yml', '.yaml', '.txt', '.html', '.css'])

// 名字拆开拼，避免这条测试命中自己。
const NAMES = [
  ['坨', '梓'].join(''),
  ['易', '书虫'].join(''),
  ['易', '存销'].join(''),
  ['易', '三国'].join(''),
  ['易', '资管'].join(''),
  ['易', '插件'].join(''),
  ['易', '签到'].join(''),
]

const RULES = [
  { name: '个人目录 C:\\Users\\<某人>', re: /C:\\+Users\\+Admin/i, scope: 'all' },
  { name: '本机盘符前缀', re: new RegExp('E:' + '\\\\+000Dev', 'i'), scope: 'all' },
  { name: '内部资料库路径', re: /AIExperts[\\/]+(ui-design|reader|player|product|hardware)/, scope: 'all' },
  { name: '内部项目名', re: new RegExp(NAMES.join('|')), scope: 'all' },
  // 会话号与 request_id 只在文档/代码里算痕迹；测试夹具里的假 id 不算。
  { name: '会话 id（uuid）', re: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i, scope: 'outside-test' },
  { name: 'request_id', re: /request_id/i, scope: 'outside-test' },
]

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP.has(entry.name)) continue
      yield* walk(join(dir, entry.name))
    } else if (TEXT.has(extname(entry.name))) {
      yield join(dir, entry.name)
    }
  }
}

const hits = []
for await (const file of walk(ROOT)) {
  const rel = relative(ROOT, file)
  const inTest = rel.startsWith('test/') || rel.startsWith('test\\')
  const text = await readFile(file, 'utf8')
  const lines = text.split('\n')
  for (const rule of RULES) {
    if (rule.scope === 'outside-test' && inTest) continue
    lines.forEach((line, index) => {
      if (rule.re.test(line)) hits.push(`${rel}:${index + 1} ${rule.name} → ${line.trim().slice(0, 80)}`)
    })
  }
}

if (hits.length) {
  throw new Error(`公开仓库里还有本机痕迹（${hits.length} 处）：\n${hits.slice(0, 40).join('\n')}`)
}
