// 检索模型的位置与会话（模型不进仓库、不进插件目录：插件升级会重写 node_modules）。
import fs from 'node:fs'
import path from 'node:path'

export const MODEL_DIR_NAME = path.join('models', 'bge-small-zh')

/** 新位置：<库根>/models/bge-small-zh/ —— 升级不覆盖、不进 git */
export function libraryModelDir(root) {
  return path.join(root, MODEL_DIR_NAME)
}

/** 旧位置：<插件根>/models/bge-small-zh/ —— 只为兼容，老用户不必重新下载 */
export function legacyModelDir(pluginDir) {
  return path.join(pluginDir, MODEL_DIR_NAME)
}

export function hasModel(dir) {
  try {
    const onnx = fs.statSync(path.join(dir, 'model-fp32.onnx'))
    const vocab = fs.statSync(path.join(dir, 'vocab.txt'))
    return onnx.size > 1024 * 1024 && vocab.size > 1024
  } catch {
    return false
  }
}

/**
 * 解析实际要用的模型目录：库根优先，其次插件内旧目录。
 * 返回 { dir, source: 'library' | 'legacy' | 'none' }
 */
export function resolveModelDir({ root, pluginDir }) {
  const lib = libraryModelDir(root)
  if (hasModel(lib)) return { dir: lib, source: 'library' }
  const legacy = legacyModelDir(pluginDir)
  if (hasModel(legacy)) return { dir: legacy, source: 'legacy' }
  return { dir: lib, source: 'none' }
}
