// 资料登记的确定性检查：
// references 下每一份「资料」（.md 文件，或带 README.md 的目录）都必须
//   1) 在 manifest.json 的 titles 里（键为 references/<名字>，或指向其内部文件）
//   2) 在 references/index.md 里露过名字
// 反方向也查：manifest 里登记的每条路径都必须真实存在。
// 目的不是让目录好看，而是让「写了资料却检索不到」这件事在测试阶段就炸出来。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { ExpertLibrary } from '../lib/library.js'

const ROOT = process.env.DSH_EXPERT_ROOT || 'E:/000Dev/AIExperts'
const hasLibrary = fs.existsSync(ROOT)

function resourcesOf(refDir) {
  const out = []
  for (const entry of fs.readdirSync(refDir, { withFileTypes: true })) {
    if (entry.name === 'index.md' || entry.name === 'queries.md') continue
    if (entry.isFile()) {
      if (entry.name.endsWith('.md')) out.push({ name: entry.name, file: path.join(refDir, entry.name) })
      continue
    }
    const readme = path.join(refDir, entry.name, 'README.md')
    if (fs.existsSync(readme)) out.push({ name: entry.name + '/', file: readme })
  }
  return out
}

test('资料都登记了：manifest + index', { skip: !hasLibrary && `找不到资料库 ${ROOT}` }, async () => {
  const lib = new ExpertLibrary(ROOT)
  const ids = await lib.listExpertIds()
  const missingManifest = []
  const missingIndex = []
  const missingFile = []

  for (const id of ids) {
    const expert = await lib.readExpert(id)
    if (!expert) continue
    const refDir = path.join(lib.expertDir(id), 'references')
    if (!fs.existsSync(refDir)) continue
    const titles = expert.titles || {}
    const indexPath = path.join(refDir, 'index.md')
    const index = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf8') : ''

    for (const res of resourcesOf(refDir)) {
      const key = 'references/' + res.name.replace(/\/$/, '')
      const covered = Object.keys(titles).some((k) => k === key || k.startsWith(key + '/'))
      if (!covered) missingManifest.push(`${id}/${res.name}`)
      if (!index.includes(res.name.replace(/\/$/, ''))) missingIndex.push(`${id}/${res.name}`)
    }

    // 反方向：登记的路径得真在盘上（允许同一名字换扩展名，如 .json/.md）
    for (const key of Object.keys(titles)) {
      if (!key.startsWith('references/')) continue
      const abs = path.join(lib.expertDir(id), key)
      if (fs.existsSync(abs)) continue
      const dir = path.dirname(abs)
      const base = path.basename(abs)
      const alt = fs.existsSync(dir)
        ? fs.readdirSync(dir).some((n) => n === base || n.replace(/\.[^.]+$/, '') === base)
        : false
      if (!alt) missingFile.push(`${id}/${key}`)
    }
  }

  assert.deepEqual(missingManifest, [], `这些资料没进 manifest.titles（检索读不到）：${missingManifest.join('、')}`)
  assert.deepEqual(missingIndex, [], `这些资料没在 references/index.md 里登记：${missingIndex.join('、')}`)
  assert.deepEqual(missingFile, [], `这些登记项指向的文件不存在：${missingFile.join('、')}`)
})
