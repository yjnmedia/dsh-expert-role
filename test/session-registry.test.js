import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  CATEGORY_IDS,
  inspectSessions,
  planSessionRepair,
  readWorkspaceEntry,
  scanCategorySessionDirs,
  sessionDirName,
} from '../lib/session-registry.js'

function tempHome() {
  return mkdtempSync(join(tmpdir(), 'expert-role-reg-'))
}

test('sessionDirName 把盘符与反斜杠折成 DSH 的会话目录名', () => {
  assert.equal(sessionDirName('X:\\work\\experts'), '--X-work-experts--')
  assert.equal(sessionDirName('D:/demo/experts'), '--D-demo-experts--')
})

test('planSessionRepair 分出「缺登记 / 缺文件 / 还没建」', () => {
  const plan = planSessionRepair({
    sessionIds: ['session-expert-cat-01', 'session-expert-cat-02'],
    present: ['session-expert-cat-01', 'session-expert-cat-03'],
  })
  assert.equal(plan.ok, false)
  assert.deepEqual(plan.missingInRegistry, ['session-expert-cat-03'])
  assert.deepEqual(plan.missingOnDisk, ['session-expert-cat-02'])
  assert.equal(plan.unknown.length, 5)

  const ok = planSessionRepair({ sessionIds: CATEGORY_IDS, present: CATEGORY_IDS })
  assert.equal(ok.ok, true)
})

test('readWorkspaceEntry 只认路径完全一致的那条，并按路径清掉尾斜杠', () => {
  const env = { DSH_HOME: tempHome() }
  mkdirSync(join(env.DSH_HOME, 'storages'), { recursive: true })
  writeFileSync(
    join(env.DSH_HOME, 'storages', 'workspace.json'),
    JSON.stringify({
      tables: {
        workspaces: {
          other: { path: 'D:\\other', sessionIds: [] },
          mine: { path: 'X:\\work\\experts\\', sessionIds: ['session-expert-cat-01'] },
        },
      },
    }),
  )
  const entry = readWorkspaceEntry({ env, root: 'X:\\work\\experts' })
  assert.equal(entry.id, 'mine')
  assert.deepEqual(entry.sessionIds, ['session-expert-cat-01'])
  assert.equal(readWorkspaceEntry({ env, root: 'X:\\nope' }), null)
})

test('scanCategorySessionDirs 只认八个大类目录，别的会话不算', () => {
  const env = { DSH_HOME: tempHome() }
  const dir = join(env.DSH_HOME, 'sessions', sessionDirName('X:\\work\\experts'))
  mkdirSync(join(dir, 'session-expert-cat-01'), { recursive: true })
  mkdirSync(join(dir, 'session-expert-cat-02'), { recursive: true })
  mkdirSync(join(dir, 'session-expert-gap-x'), { recursive: true })
  assert.deepEqual(scanCategorySessionDirs({ env, root: 'X:\\work\\experts' }), [
    'session-expert-cat-01',
    'session-expert-cat-02',
  ])
})

test('inspectSessions 合起来报「磁盘有、登记没有」', () => {
  const env = { DSH_HOME: tempHome() }
  mkdirSync(join(env.DSH_HOME, 'storages'), { recursive: true })
  writeFileSync(
    join(env.DSH_HOME, 'storages', 'workspace.json'),
    JSON.stringify({
      tables: { workspaces: { mine: { path: 'X:\\work\\experts', sessionIds: ['session-expert-cat-01'] } } },
    }),
  )
  const dir = join(env.DSH_HOME, 'sessions', sessionDirName('X:\\work\\experts'))
  mkdirSync(join(dir, 'session-expert-cat-01'), { recursive: true })
  mkdirSync(join(dir, 'session-expert-cat-04'), { recursive: true })

  const state = inspectSessions({ env, root: 'X:\\work\\experts' })
  assert.equal(state.workspace.id, 'mine')
  assert.deepEqual(state.missingInRegistry, ['session-expert-cat-04'])
  assert.equal(state.ok, false)
})
