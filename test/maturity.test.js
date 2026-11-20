import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { ExpertLibrary } from '../lib/library.js'
import { expertMaturity, clearMaturityCache } from '../lib/maturity.js'

const BODY = `${'一句话结论：先看图再定参数。'.repeat(20)}\n来源 https://example.com/a\n${'细节说明。'.repeat(400)}`

/** 造一个足够完整的专家：6 个主题 × 2 份资料，索引有真实说明，计划全完成。 */
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'expert-maturity-'))
  const lib = new ExpertLibrary(root)
  await lib.ensureRoot()
  const dir = join(root, 'demo')
  await mkdir(join(dir, 'references'), { recursive: true })
  await mkdir(join(dir, '资料快捷方式'), { recursive: true })

  const topics = []
  const titles = {}
  const indexRows = []
  const mappingRows = []
  for (let t = 0; t < 6; t += 1) {
    const files = []
    for (let f = 0; f < 2; f += 1) {
      const rel = `references/t${t}-${f}.md`
      await writeFile(join(dir, rel), BODY, 'utf8')
      files.push(rel)
      titles[rel] = `资料 ${t}-${f}`
      indexRows.push(`| 资料 ${t}-${f} | \`${rel}\` | 这份资料说明第 ${t} 个主题的具体做法 |`)
      mappingRows.push(`| 资料 ${t}-${f} | \`${rel}\` | 第 ${t} 主题 |`)
      await writeFile(join(dir, '资料快捷方式', `资料 ${t}-${f}.lnk`), '', 'utf8')
    }
    topics.push({ id: `t${t}`, title: `主题 ${t}`, whenToUse: `要做主题 ${t} 的事时`, files })
  }

  await writeFile(
    join(dir, 'manifest.json'),
    JSON.stringify({ title: '演示专家', description: '用于测试', mode: 'parallel', topics, titles }, null, 2),
    'utf8',
  )
  await writeFile(join(dir, 'references', 'index.md'), ['# 资料索引', '', ...indexRows].join('\n'), 'utf8')
  await writeFile(join(dir, '资料对照.md'), ['# 对照', '', ...mappingRows].join('\n'), 'utf8')
  await writeFile(join(dir, 'SKILL.md'), `---\nname: expert-demo\ndescription: 演示\n---\n\n# 演示\n\n${'正文。'.repeat(800)}`, 'utf8')
  await writeFile(
    join(dir, 'survey.md'),
    [
      '# 演示 · 尽调计划',
      '',
      'mode: parallel',
      '',
      '## 目标',
      '',
      '把演示领域的资料查清楚，形成能回答常见问题的资料库，并记录来源。',
      '',
      '## 步骤',
      '',
      '- [x] 1. 查平台',
      '- [x] 2. 查提示词',
      '- [x] 3. 查参数',
      '- [x] 4. 交叉核对',
      '',
      '## 进度记录',
      '',
      '| 步骤 | 状态 | 结论 | 时间 |',
      '|---|---|---|---|',
      '| 1 | done | 查到 3 个平台，2 个可用 | 2026-11-16 |',
      '| 2 | done | 整理 12 条写法 | 2026-11-16 |',
      '| 3 | done | 步数 4，CFG 1.0 | 2026-11-16 |',
      '| 4 | done | 核对 8 条，0 冲突 | 2026-11-16 |',
      '',
    ].join('\n'),
    'utf8',
  )
  return { root, dir, lib }
}

function traceFixture(skillBytes) {
  const now = Date.now()
  const iso = (offsetMinutes) => new Date(now - offsetMinutes * 60000).toISOString()
  return [
    { ts: iso(30), kind: 'skill_load', expert: 'demo', session: 's1', chars: skillBytes },
    { ts: iso(20), kind: 'ref_read', expert: 'demo', session: 's1', path: 'references/t0-0.md', chars: 4096 },
    { ts: iso(10), kind: 'write', expert: 'demo', session: 's1', path: 'references/t0-0.md' },
    { ts: iso(15), kind: 'skill_load', expert: 'demo', session: 's2', chars: skillBytes },
    { ts: iso(12), kind: 'skill_load', expert: 'demo', session: 's3', chars: skillBytes },
  ]
}

test('六维打分：完整库能算出高分，且三个会话都算进去', async () => {
  const { root, lib } = await fixture()
  clearMaturityCache()
  const expert = await lib.readExpert('demo')
  const trace = traceFixture(Buffer.byteLength(expert.body) + 200)
  const result = await expertMaturity({ library: lib, expert, trace })
  assert.equal(result.materials, 12)
  assert.equal(result.topics, 6)
  assert.equal(result.sessions, 3)
  assert.equal(result.loads.valid, 3)
  assert.ok(result.dims.D1 > 0.9, `D1 应接近满分，实际 ${result.dims.D1}`)
  assert.ok(result.dims.D2 > 0.75, `D2 应高，实际 ${result.dims.D2}`)
  assert.ok(result.dims.D5 > 0.6, `D5 应因为 3 个会话而高，实际 ${result.dims.D5}`)
  assert.ok(result.dims.D6 > 0.9, `D6 应接近满分，实际 ${result.dims.D6}`)
  assert.ok(['可靠', '权威', '标杆'].includes(result.tier), `档位应不低，实际 ${result.tier}`)
  assert.ok(result.score >= 70, `总分应 >= 70，实际 ${result.score}`)
  assert.ok(root)
})

test('占位加载不算真实使用', async () => {
  const { lib } = await fixture()
  clearMaturityCache()
  const expert = await lib.readExpert('demo')
  const trace = traceFixture(202) // 远小于 SKILL.md 字节数，判为占位
  const result = await expertMaturity({ library: lib, expert, trace })
  assert.equal(result.loads.valid, 0)
  assert.equal(result.loads.stub, 3)
  assert.equal(result.dims.D5 < 0.3, true, `占位加载后 D5 应很低，实际 ${result.dims.D5}`)
})

test('索引模板句与空计划会拉低分数，并让短板指向调研闭环', async () => {
  const { lib, dir } = await fixture()
  clearMaturityCache()
  const index = await readFile(join(dir, 'references', 'index.md'), 'utf8')
  await writeFile(join(dir, 'references', 'index.md'), index.replace(/这份资料说明.*?\|/g, '资料本体都在这个专家目录下 |'), 'utf8')
  await writeFile(join(dir, 'survey.md'), '# 演示\n\nmode: serial\n\n## 目标\n\n短\n\n## 步骤\n\n## 进度记录\n\n| 步骤 | 状态 | 结论 | 时间 |\n|---|---|---|---|\n', 'utf8')
  const expert = await lib.readExpert('demo')
  const result = await expertMaturity({ library: lib, expert, trace: [] })
  assert.ok(result.dims.D1 < 0.9, `D1 应被模板句拉低，实际 ${result.dims.D1}`)
  assert.equal(result.dims.D6, 0)
  assert.ok(['D5', 'D6'].includes(result.weakest), `短板应指向没用过/没计划，实际 ${result.weakest}`)
  assert.ok(result.tier === '起步' || result.tier === '可用')
})
