import { basename } from 'node:path'

/**
 * 把一个资料目录采纳成左侧工作区。
 *
 * 宿主服务 `ctx.workspaceController` 的 `create({ path })` 是幂等的：
 * 目录已经是工作区时返回原来的那条，`created` 为 false。客户端侧的
 * `ctx.workspaces.create(input)` 走的是同一个动作，只是返回值只有 workspace。
 *
 * @param {{ create?: (request: { path: string }) => Promise<any> } | undefined} controller 宿主工作区控制器
 * @param {string} dir 要放上左侧的绝对路径
 * @returns {Promise<{ ok: boolean, reason?: string, created?: boolean, id?: string | null, title?: string | null }>}
 */
export async function adoptWorkspace(controller, dir) {
  if (!dir) return { ok: false, reason: 'no-directory' }
  if (!controller || typeof controller.create !== 'function') {
    return { ok: false, reason: 'no-service' }
  }

  const result = await controller.create({ path: dir })
  const workspace = result && result.workspace ? result.workspace : result
  return {
    ok: true,
    created: result && result.created === false ? false : true,
    id: workspace?.workspaceId ?? null,
    title: workspace?.title ?? basename(dir) ?? null,
  }
}
