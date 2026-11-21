/**
 * 请求准入：面板接口不能只靠「来源 IP 是不是本机」。
 *
 * 浏览器的网页请求本机地址时，服务端看到的来源同样是 127.0.0.1，所以
 * 只看 IP 挡不住任何网页。宿主为此提供了 connection 服务：
 *   - 新宿主：connection.admit(req) -> { peer?, rejection? }
 *   - 旧宿主：connection.requestRejection(req) -> undefined 表示放行
 * 宿主没有这个服务时返回 null，调用方沿用原来的本机判断（不破坏旧版本）。
 */

function resolveConnection(ctx) {
  try {
    const direct = typeof ctx.get === 'function' ? ctx.get('connection', false) : null
    if (direct) return direct
    return typeof ctx.get === 'function' ? ctx.get('connection') : null
  } catch {
    return null
  }
}

/** @returns {'allow'|'deny'|'unknown'} */
function verdict(connection, req) {
  if (!connection) return 'unknown'
  try {
    if (typeof connection.admit === 'function') {
      const admission = connection.admit(req)
      if (!admission || typeof admission !== 'object') return 'deny'
      if (admission.rejection !== undefined) return 'deny'
      return admission.peer !== undefined ? 'allow' : 'deny'
    }
    if (typeof connection.requestRejection === 'function') {
      return connection.requestRejection(req) === undefined ? 'allow' : 'deny'
    }
  } catch {
    return 'unknown'
  }
  return 'unknown'
}

/**
 * 生成一个请求守卫。
 * @param {object} ctx 宿主上下文
 * @returns {(req: import('node:http').IncomingMessage) => boolean} false 表示拒绝
 */
export function createGuard(ctx) {
  return function isAllowed(req) {
    const state = verdict(resolveConnection(ctx), req)
    // unknown：宿主没有准入服务，或调用抛错 —— 交给调用方按本机判断，避免把面板锁死。
    return state !== 'deny'
  }
}

/** 供测试与非 Cordis 调用方使用：直接传 connection 对象。 */
export function connectionVerdict(connection, req) {
  return verdict(connection, req)
}
