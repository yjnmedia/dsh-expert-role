import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm, rename } from 'node:fs/promises'
import { mkdtempSync, mkdirSync, writeFileSync, renameSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ExpertLibrary } from '../lib/library.js'

async function makeLib() {
  const root = await mkdtemp(join(tmpdir(), 'expert-layout-'))
  return { root, lib: new ExpertLibrary(root) }
}

test('两级目录：大类下的专家能被列出，expertDir 指到大类里', async () => {
  const { root, lib } = await makeLib()
  await mkdir(join(root, '01-平台与运行', 'player', 'references'), { recursive: true })
  await writeFile(join(root, '01-平台与运行', 'player', 'manifest.json'), JSON.stringify({ title: '播放器专家' }), 'utf8')
  await writeFile(join(root, '01-平台与运行', 'player', 'SKILL.md'), '---\nname: expert-player\n---\n正文', 'utf8')
  await mkdir(join(root, 'old-flat'), { recursive: true })
  await writeFile(join(root, 'old-flat', 'manifest.json'), JSON.stringify({ title: '老目录' }), 'utf8')

  assert.deepEqual(await lib.listExpertIds(), ['old-flat', 'player'])
  assert.equal(lib.expertRel('player'), '01-平台与运行/player')
  assert.equal(lib.expertRel('old-flat'), 'old-flat')

  const expert = await lib.readExpert('player')
  assert.equal(expert.title, '播放器专家')
  assert.equal(expert.skillName, 'expert-player')

  await lib.updateSurvey('player', { goal: '查清楚', steps: ['一'] })
  const again = await lib.readExpert('player')
  assert.equal(again.survey.goal, '查清楚')
  await rm(root, { recursive: true, force: true })
})

test('大类目录本身不算专家', async () => {
  const { root, lib } = await makeLib()
  await mkdir(join(root, '02-工程与交付'), { recursive: true })
  assert.deepEqual(await lib.listExpertIds(), [])
  await rm(root, { recursive: true, force: true })
})

test('库根目录改名后无需重建实例也能重新扫描', async () => {
  const root = mkdtempSync(join(tmpdir(), 'expert-layout-cache-'))
  const lib = new ExpertLibrary(root)
  mkdirSync(join(root, 'player'))
  writeFileSync(join(root, 'player', 'SKILL.md'), '---\nname: player\ndescription: x\n---\n', 'utf8')
  assert.equal(lib.expertDir('player'), join(root, 'player'))
  mkdirSync(join(root, '06-终端与场景'))
  renameSync(join(root, 'player'), join(root, '06-终端与场景', 'player'))
  assert.equal(lib.expertDir('player'), join(root, '06-终端与场景', 'player'))
})
