import { join } from 'node:path'
import { MISSING_GUIDE, skillDescription } from './library.js'
import { readSettings } from './settings.js'

export const PROVIDER_ID = 'expert-role'
export const DEFAULT_RANK = 40

/**
 * 把专家库里的每个专家目录暴露成一条技能。
 * 契约来自 @deepseek-ai/dsh-skill：provider 需要 name，list() 返回 candidate 数组，
 * get(candidate) 返回完整定义（name 必须与 candidate.name 一致）。
 */
/**
 * 技能正文里没有兜底段就补上：库里查不到资料时，模型必须停下来问用户，
 * 而不是用模型记忆硬编。写到文件里也行，但宿主读的是这里返回的 content。
 */
function withMissingGuide(body) {
  const text = String(body ?? '')
  return text.includes('资料库没覆盖时') ? text : `${text.trimEnd()}\n\n${MISSING_GUIDE}\n`
}

export function createExpertProvider(library, options = {}) {
  const rank = options.rank ?? DEFAULT_RANK
  const provider = {
    name: PROVIDER_ID,

    async list() {
      const experts = await library.listExperts()
      // 目录里放几张卡由设置里的 mode 决定：
      //   auto       全部专家都挂出来，模型自己判断要不要查
      //   on-request 只留总入口，模型想查也得先读它那张表
      //   off        一条都不挂，专家库静默
      const settings = await readSettings(library.root).catch(() => ({ mode: 'auto' }))
      const mode = settings?.mode ?? 'auto'
      if (mode === 'off') return []
      const rows = experts.filter((expert) => expert.hasSkill && expert.expose !== 'none')
      const keep = mode === 'on-request' ? rows.filter((expert) => expert.role === 'router') : rows
      return keep.map((expert) => provider.candidate(expert))
    },

    async get(candidate) {
      const expertId = candidate?.metadata?.expertId
      const expert = await library.readExpert(expertId ?? String(candidate.name).replace(/^expert-/, ''))
      return { ...provider.candidate(expert), content: withMissingGuide(expert.body) }
    },

    candidate(expert) {
      const skillPath = join(expert.dir, 'SKILL.md')
      // 描述统一按 skillDescription 生成：管什么 + 什么时候用 + 多少份，
      // 目录只渲染 name + description，whenToUse 不会被单独显示。
      const description = skillDescription(expert)
      return {
        name: expert.skillName,
        description,
        ...(expert.whenToUse ? { whenToUse: expert.whenToUse } : {}),
        invocation: { modelInvocable: true, userInvocable: true },
        provider: PROVIDER_ID,
        source: 'expert-library',
        rank,
        locator: { path: skillPath, directory: expert.dir },
        resourceBase: { kind: 'directory', path: expert.dir },
        path: skillPath,
        metadata: { expertId: expert.id, title: expert.title, status: expert.status, mode: expert.mode, whenToUse: expert.whenToUse ?? '' },
      }
    },

    dispose() {},
  }
  return provider
}
