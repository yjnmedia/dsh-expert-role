import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  countExperts,
  defaultDataDir,
  isSystemDrive,
  listCandidates,
  migrateDataDir,
  isUsableDataDir,
  pointerPath,
  resolveDataDir,
  resolveDataDirSync,
  resetDataDir,
  setDataDir,
  dataDirStatus,
} from '../lib/datadir.js'

async function workspace() {
  const base = await mkdtemp(join(tmpdir(), 'expert-datadir-'))
  return { base, home: join(base, 'dsh-home'), env: { DSH_HOME: join(base, 'dsh-home') } }
}

test('默认位置在 DSH_HOME 下，不是用户主目录', async () => {
  const { home, env } = await workspace()
  assert.equal(defaultDataDir(env), join(home, 'expert-role', 'experts'))
  const resolved = await resolveDataDir(env)
  assert.equal(resolved.source, 'default')
  assert.equal(resolved.dir, join(home, 'expert-role', 'experts'))
})

test('环境变量优先于指针文件', async () => {
  const { base, env } = await workspace()
  await setDataDir(join(base, 'other'), { env })
  const resolved = await resolveDataDir({ ...env, DSH_EXPERT_ROOT: join(base, 'from-env') })
  assert.equal(resolved.source, 'env')
  assert.equal(resolved.dir, join(base, 'from-env'))
})

test('换目录后指针生效，重启后能读到新位置', async () => {
  const { base, env } = await workspace()
  const target = join(base, 'D盘', 'experts')
  const result = await setDataDir(target, { env })
  assert.equal(result.restartRequired, true)
  assert.ok(existsSync(join(pointerPath(env))))
  const resolved = await resolveDataDir(env)
  assert.equal(resolved.source, 'pointer')
  assert.equal(resolved.dir, target)
  assert.equal(resolveDataDirSync(env).dir, target)
})

test('复制现有资料：旧目录保留', async () => {
  const { base, env } = await workspace()
  const from = join(base, 'old')
  await mkdir(join(from, 'design', 'references'), { recursive: true })
  await writeFile(join(from, 'design', 'SKILL.md'), '# 设计专家\n', 'utf8')
  const result = await setDataDir(join(base, 'new'), { copy: true, from, env })
  assert.ok(result.copied >= 1)
  assert.ok(existsSync(join(base, 'new', 'design', 'SKILL.md')))
  assert.ok(existsSync(join(from, 'design', 'SKILL.md')), '旧目录不能被删')
})

test('恢复默认只删指针，不动数据', async () => {
  const { base, env } = await workspace()
  const target = join(base, 'moved')
  await setDataDir(target, { env })
  const result = await resetDataDir(env)
  assert.equal(result.cleared, true)
  assert.equal(existsSync(pointerPath(env)), false)
  assert.equal(existsSync(target), true, '数据目录还在')
  const resolved = await resolveDataDir(env)
  assert.equal(resolved.source, 'default')
})

test('拒绝盘根和 DSH 自己的家目录', async () => {
  const { home, env } = await workspace()
  const root = process.platform === 'win32' ? 'C:\\' : '/'
  assert.equal(isUsableDataDir(root, env).ok, false)
  assert.equal(isUsableDataDir(home, env).ok, false)
  assert.equal(isUsableDataDir('  ', env).ok, false)
  assert.equal(isUsableDataDir(join(home, 'ok'), env).ok, true)
  await assert.rejects(() => setDataDir(root, { env }), /盘根|完整路径/)
})

test('状态里带出默认位置、是否改过、是否待重启', async () => {
  const { base, env } = await workspace()
  const active = join(base, 'active')
  await setDataDir(join(base, 'next'), { env })
  const status = await dataDirStatus({ env, activeDir: active })
  assert.equal(status.active, active)
  assert.equal(status.pending, true)
  assert.equal(status.overridden, true)
  assert.equal(status.defaultDir, defaultDataDir(env))
})

test('迁移：整库搬过去，指针跟着改，旧目录按选择保留或删除', async () => {
  const { base, env } = await workspace()
  const from = join(base, 'old')
  await mkdir(join(from, 'design', 'references'), { recursive: true })
  await writeFile(join(from, 'design', 'SKILL.md'), '# 设计专家\n', 'utf8')
  await mkdir(join(from, 'reader'), { recursive: true })
  await writeFile(join(from, 'reader', 'SKILL.md'), '# 阅读器专家\n', 'utf8')

  const kept = await migrateDataDir(join(base, 'new'), { from, deleteOld: false, env })
  assert.equal(kept.moved, 2)
  assert.equal(kept.deleted, false)
  assert.ok(existsSync(join(base, 'new', 'reader', 'SKILL.md')))
  assert.ok(existsSync(join(from, 'reader', 'SKILL.md')), '没勾删就保留旧目录')
  assert.equal((await resolveDataDir(env)).dir, join(base, 'new'))

  const gone = await migrateDataDir(join(base, 'newer'), { from: join(base, 'new'), deleteOld: true, env })
  assert.equal(gone.deleted, true)
  assert.equal(existsSync(join(base, 'new')), false)
  assert.equal((await resolveDataDir(env)).dir, join(base, 'newer'))
})

test('迁移时目标已有同名专家不会覆盖，且专家数够才删旧目录', async () => {
  const { base, env } = await workspace()
  const from = join(base, 'src')
  await mkdir(join(from, 'a'), { recursive: true })
  await writeFile(join(from, 'a', 'SKILL.md'), '旧\n', 'utf8')
  const target = join(base, 'dst')
  await mkdir(join(target, 'a'), { recursive: true })
  await writeFile(join(target, 'a', 'SKILL.md'), '新\n', 'utf8')
  const result = await migrateDataDir(target, { from, deleteOld: true, env })
  assert.equal(result.moved, 1)
  assert.equal(await readFile(join(target, 'a', 'SKILL.md'), 'utf8'), '新\n', '不覆盖已有的')
  assert.equal(existsSync(from), false, '专家数够，删除旧目录')
})

test('候选库只列真正有专家的目录，并标出系统盘', async () => {
  const { base, env } = await workspace()
  const seat = defaultDataDir(env)
  await mkdir(join(seat, 'design'), { recursive: true })
  await writeFile(join(seat, 'design', 'SKILL.md'), '# x\n', 'utf8')
  const list = await listCandidates({ env })
  assert.equal(list.length >= 1, true)
  assert.equal(list[0].dir, seat)
  assert.equal(list[0].experts, 1)
  assert.equal(typeof list[0].systemDrive, 'boolean')
  assert.equal(await countExperts(join(base, 'nope')), 0)
})

test('系统盘判断：C 是真、E 是假', () => {
  assert.equal(isSystemDrive('C:\\x'), true)
  assert.equal(isSystemDrive('E:\\x'), false)
})
