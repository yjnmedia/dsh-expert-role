import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_MODE, DEFAULT_RESEARCH, readSettings, writeSettings } from '../lib/settings.js'
import { isResearchSession } from '../lib/library.js'

async function root() {
  return mkdtemp(join(tmpdir(), 'expert-settings-'))
}

test('没设置文件时给默认：点名才查 + 串行调研', async () => {
  const dir = await root()
  const s = await readSettings(dir)
  assert.equal(s.mode, DEFAULT_MODE)
  assert.equal(s.research, DEFAULT_RESEARCH)
})

test('调研方式可以单独改，不改调用方式', async () => {
  const dir = await root()
  await writeSettings(dir, { research: 'parallel' })
  const s = await readSettings(dir)
  assert.equal(s.research, 'parallel')
  assert.equal(s.mode, DEFAULT_MODE)
  assert.match(await readFile(join(dir, 'settings.json'), 'utf8'), /parallel/)
})

test('调研方式写错直接拒绝', async () => {
  const dir = await root()
  await assert.rejects(() => writeSettings(dir, { research: 'turbo' }), /research/)
})

test('settings.json 坏了退回默认，不炸', async () => {
  const dir = await root()
  await writeFile(join(dir, 'settings.json'), '{not json', 'utf8')
  const s = await readSettings(dir)
  assert.equal(s.mode, DEFAULT_MODE)
})

test('插件自己开的调研会话不算使用者', () => {
  assert.equal(isResearchSession('session-expert-task-1234'), true)
  assert.equal(isResearchSession('session-expert-ai-image-1794793969511'), true)
  assert.equal(isResearchSession('session-demo-2-4c66-9d3e-5f3d9d0a1234'), false)
  assert.equal(isResearchSession(''), false)
})
