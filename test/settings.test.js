import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'


test('汇报节奏默认 turn，非法值回退且写入校验', async () => {
  const { readSettings, writeSettings, DEFAULT_REPORT_MODE } = await import('../lib/settings.js')
  const root = await mkdtemp(join(tmpdir(), 'er-settings-report-'))
  try {
    assert.equal(DEFAULT_REPORT_MODE, 'turn')
    assert.equal((await readSettings(root)).reportMode, 'turn')
    await writeSettings(root, { reportMode: 'step' })
    assert.equal((await readSettings(root)).reportMode, 'step')
    await assert.rejects(() => writeSettings(root, { reportMode: 'nope' }), /reportMode/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
