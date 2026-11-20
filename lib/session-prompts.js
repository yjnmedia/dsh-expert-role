// 从 docs/session-prompts.md 读出八个大类会话的开场提示词。
// 只认一种格式：`## NN 类名` 标题 + 紧随其后的第一个 ```text 代码块。
// 文档是唯一来源，这里不再抄一份，避免两处不一致。

import { readFile } from 'node:fs/promises'

const HEAD = /^##\s+(\d{2})\s+(.+?)\s*$/

/** 解析 markdown，返回 [{ index, title, prompt }]；解析不出来就抛错，别静默少建。 */
export function parsePrompts(markdown) {
  const lines = String(markdown).split(/\r?\n/)
  const out = []
  for (let i = 0; i < lines.length; i += 1) {
    const hit = HEAD.exec(lines[i])
    if (!hit) continue
    // 跳过「首条消息」这种没有编号的说明块：标题必须带两位编号。
    let j = i + 1
    let block = null
    while (j < lines.length) {
      if (lines[j].startsWith('```')) {
        const lang = lines[j].slice(3).trim()
        const body = []
        j += 1
        while (j < lines.length && !lines[j].startsWith('```')) {
          body.push(lines[j])
          j += 1
        }
        if (lang === 'text') {
          block = body.join('\n').trim()
          break
        }
        continue
      }
      if (HEAD.test(lines[j])) break
      j += 1
    }
    if (!block) continue
    out.push({ index: hit[1], title: `${hit[1]} ${hit[2]}`, prompt: block })
  }
  return out.sort((a, b) => a.index.localeCompare(b.index))
}

/** 读「首条消息」那一节里的 text 代码块；没有就返回空串。 */
export function parseOpening(markdown) {
  const lines = String(markdown).split(/\r?\n/)
  let inSection = false
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    if (line.startsWith('## ')) inSection = line.includes('首条消息')
    if (!inSection) continue
    if (!line.startsWith('```')) continue
    const lang = line.slice(3).trim()
    const body = []
    i += 1
    while (i < lines.length && !lines[i].startsWith('```')) {
      body.push(lines[i])
      i += 1
    }
    if (lang === 'text') return body.join('\n').trim()
  }
  return ''
}

/** 把文档里的 `<库根>` 占位换成本机实际的库根（文档要能公开，不能写死路径）。 */
export function fillRoot(text, root) {
  const dir = String(root || '').replace(/[\\/]+$/, '')
  if (!dir) return String(text)
  return String(text).split('<库根>').join(dir)
}

/** 读文档并解析；少于 8 条视为文档被改坏。 */
export async function loadPrompts(file) {
  const markdown = await readFile(file, 'utf8')
  const list = parsePrompts(markdown)
  if (list.length < 8) {
    throw new Error(`提示词文档只解析出 ${list.length} 段，应至少 8 段：${file}`)
  }
  return { list, opening: parseOpening(markdown) }
}
