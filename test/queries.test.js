import assert from 'node:assert/strict'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { parseQueries, scoreQueries } from '../lib/queries.js'

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'expert-queries-'))
  await mkdir(join(dir, 'references', 'prompt'), { recursive: true })
  await mkdir(join(dir, 'references', 'lock'), { recursive: true })
  await writeFile(
    join(dir, 'references', 'index.md'),
    [
      '# 索引',
      '| 提示词 | `references/prompt` | 画动漫女孩的三段式提示词写法 |',
      '| 锁脸 | `references/lock` | 人脸不像原图时调参考图强度 |',
      '',
    ].join('\n'),
    'utf8',
  )
  await writeFile(join(dir, 'references', 'prompt', 'README.md'), '# 提示词\n动漫女孩：主体、风格、镜头三段式；镜头建议 35mm，主体占画面 60%。', 'utf8')
  await writeFile(join(dir, 'references', 'lock', 'README.md'), '# 锁脸\n人脸不像时提高参考图强度到 0.6–0.8；验收 margin 至少 +0.005 才算过。', 'utf8')
  return dir
}

test('解析 queries.md 的表格行', async () => {
  const dir = await fixture()
  await writeFile(
    join(dir, 'references', 'queries.md'),
    ['| 问法 | 应该命中 | 要点 | 上次自测 |', '|---|---|---|---|', '| 画动漫女孩怎么写提示词 | prompt | 三段式 |  |', ''].join('\n'),
    'utf8',
  )
  const rows = await parseQueries(dir)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].expect, 'prompt')
})

test('命中率按「期望资料是否进前三」算，不看不相关的问法', async () => {
  const dir = await fixture()
  await writeFile(
    join(dir, 'references', 'queries.md'),
    [
      '| 问法 | 应该命中 | 要点 | 上次自测 |',
      '|---|---|---|---|',
      '| 画动漫女孩怎么写提示词 | prompt | 三段式 |  |',
      '| 人脸不像原图怎么锁住 | lock | 参考图强度 |  |',
      '| 今天几号 | prompt | 无 |  |',
      '',
    ].join('\n'),
    'utf8',
  )
  const result = await scoreQueries(dir)
  assert.equal(result.total, 3)
  assert.ok(result.hit >= 2, `命中数应至少 2，实际 ${result.hit}`)
  assert.ok(result.rate >= 60, `命中率应至少 60，实际 ${result.rate}`)
  assert.ok(result.text.includes('自测'))
})

test('没有 queries.md 时返回 undefined，不编造命中率', async () => {
  const dir = await fixture()
  assert.equal(await scoreQueries(dir), undefined)
})
