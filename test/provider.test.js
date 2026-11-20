import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createExpertProvider, PROVIDER_ID } from '../lib/provider.js'

const SKILL_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/

function fakeLibrary() {
  return {
    async listExperts() {
      return [
        { id: 'ai-image', dir: 'C:\\AIExperts\\ai-image', title: 'AI 生图', description: '生图资料', whenToUse: '做生图时', skillName: 'expert-ai-image', status: 'surveying', mode: 'serial', body: '# AI 生图\n', hasSkill: true },
        { id: 'no-skill', dir: 'C:\\AIExperts\\no-skill', title: '空专家', description: '', skillName: 'expert-no-skill', status: 'draft', mode: 'serial', body: '', hasSkill: false },
        { id: 'hidden', dir: 'C:\\AIExperts\\hidden', title: '只做目录', description: '不注册技能', whenToUse: '', skillName: 'expert-hidden', status: 'surveying', mode: 'serial', body: '# 只做目录\n', hasSkill: true, expose: 'none' },
      ]
    },
    async readExpert(id) {
      const expert = (await this.listExperts()).find((item) => item.id === id)
      if (!expert) throw new Error(`no expert ${id}`)
      return expert
    },
  }
}

test('provider 暴露 name 给 skills 服务', () => {
  const provider = createExpertProvider(fakeLibrary())
  assert.equal(provider.name, PROVIDER_ID)
  assert.equal(typeof provider.list, 'function')
  assert.equal(typeof provider.get, 'function')
})

test('list 只返回带 SKILL.md 的专家，字段满足 skill 服务校验', async () => {
  const provider = createExpertProvider(fakeLibrary())
  const candidates = await provider.list()
  assert.equal(candidates.length, 1)
  const candidate = candidates[0]
  assert.match(candidate.name, SKILL_NAME)
  assert.equal(candidate.provider, PROVIDER_ID)
  assert.equal(typeof candidate.description, 'string')
  assert.ok(candidate.description.length > 0)
  assert.equal(typeof candidate.source, 'string')
  assert.equal(typeof candidate.rank, 'number')
  assert.deepEqual(candidate.invocation, { modelInvocable: true, userInvocable: true })
  assert.equal(candidate.metadata.expertId, 'ai-image')
  assert.equal(candidate.resourceBase.kind, 'directory')
})

test('get 返回同名定义并带正文', async () => {
  const provider = createExpertProvider(fakeLibrary())
  const [candidate] = await provider.list()
  const definition = await provider.get(candidate)
  assert.equal(definition.name, candidate.name)
  assert.equal(definition.provider, PROVIDER_ID)
  assert.match(definition.content, /# AI 生图/)
})

test('expose 为 none 的专家不注册成技能', async () => {
  const provider = createExpertProvider(fakeLibrary())
  const candidates = await provider.list()
  assert.deepEqual(candidates.map((item) => item.name), ['expert-ai-image'])
})

test('技能描述按规范生成：管什么 + 什么时候用 + 多少份', async () => {
  const { skillDescription, SKILL_DESCRIPTION_MAX } = await import('../lib/library.js')
  const text = skillDescription({
    id: 'demo',
    title: '演示',
    whenToUse: '要演示时',
    topics: [
      { title: '甲', files: ['a.md'] },
      { title: '乙', files: ['b.md', 'c.md'] },
    ],
  })
  assert.match(text, /^「演示」资料库：甲、乙。/)
  assert.match(text, /用于：要演示时。/)
  assert.match(text, /3 份资料，先查再答。/)
  assert.ok(text.length <= SKILL_DESCRIPTION_MAX)

  const custom = skillDescription({ id: 'x', title: 'X', skillDescription: '自定义描述' })
  assert.equal(custom, '自定义描述')

  const long = skillDescription({
    id: 'y',
    title: 'Y',
    whenToUse: '这是一段很长的触发条件说明，用来把描述撑到上限以外，'.repeat(20),
    topics: Array.from({ length: 30 }, (_, i) => ({ title: `主题${i}`, files: [] })),
  })
  assert.ok(long.length <= SKILL_DESCRIPTION_MAX)
  assert.ok(long.endsWith('…'))
})

test('on-request 档技能目录只留总入口', async () => {
  const { mkdtemp, writeFile, mkdir } = await import('node:fs/promises')
  const { join } = await import('node:path')
  const { tmpdir } = await import('node:os')
  const { ExpertLibrary } = await import('../lib/library.js')
  const { createExpertProvider } = await import('../lib/provider.js')

  const root = await mkdtemp(join(tmpdir(), 'expert-mode-'))
  await writeFile(join(root, 'settings.json'), JSON.stringify({ mode: 'on-request' }), 'utf8')

  async function makeExpert(id, role) {
    const dir = join(root, id)
    await mkdir(join(dir, 'references'), { recursive: true })
    await writeFile(
      join(dir, 'SKILL.md'),
      `---\nname: expert-${id}\ndescription: ${id} 资料\n---\n\n# ${id}\n`,
      'utf8',
    )
    await writeFile(
      join(dir, 'manifest.json'),
      JSON.stringify({ id, title: id, expose: 'skill', role }),
      'utf8',
    )
  }
  await makeExpert('alpha', 'expert')
  await makeExpert('router-one', 'router')

  const provider = createExpertProvider(new ExpertLibrary(root))
  const list = await provider.list()
  assert.deepEqual(list.map((item) => item.name), ['expert-router-one'])
})
