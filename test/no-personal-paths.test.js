import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const SKIP = new Set(['node_modules', '.git', '.tmp', '.trace', 'models', 'coverage'])
const TEXT = /\.(js|mjs|cjs|json|md|yml|yaml|txt|html|css)$/i

const FORBIDDEN = [
  { pattern: /C:\\Users\\Admin/i, why: '本机用户名' },
  { pattern: /E:\\000Dev/i, why: '本机源码盘' },
  { pattern: /session-[0-9a-f]{8}-[0-9a-f]{4}/i, why: '真实会话 id' },
  { pattern: new RegExp(['request','id'].join('_'), 'i'), why: '请求痕迹' },
  { pattern: new RegExp(['坨','梓'].join('') + '|' + ['易','书','虫'].join('') + '|' + ['易','存','销'].join('') + '|' + ['易','三','国'].join('')), why: '内部项目名' },
  { pattern: /AIExperts[\\/](ui-design|reader|player)/, why: '内部专家组合' },
]

async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) await walk(full, out)
    else if (TEXT.test(entry.name)) out.push(full)
  }
  return out
}

test('公开包里没有本机路径、会话痕迹与内部项目名', async () => {
  const files = await walk(ROOT)
  assert.ok(files.length > 50, '扫到的文件太少，检查是否漏扫')
  const hits = []
  for (const file of files) {
    const text = await readFile(file, 'utf8')
    for (const rule of FORBIDDEN) {
      if (rule.pattern.test(text)) hits.push(`${relative(ROOT, file)} → ${rule.why}`)
    }
  }
  assert.deepEqual(hits, [], `发现不该出现在公开包里的内容：\n${hits.join('\n')}`)
})
