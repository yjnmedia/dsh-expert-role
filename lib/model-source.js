// 向量模型的分发源与下载。
// 顺序按用户要求：先探国外源（huggingface.co），再探镜像速度，最后才用 COS。
import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

export const MODEL_FILES = [
  {
    name: 'model-fp32.onnx',
    size: 94851877,
    sha256: '69a0b846f4f116b5e6aabf9546ea6754d02264f3211a13a1bd69b31b8040749a',
  },
  {
    name: 'vocab.txt',
    size: 109540,
    sha256: '45bbac6b341c319adc98a532532882e91a9cefc0329aa57bac9ae761c27b291c',
  },
]

export const SOURCES = [
  {
    id: 'hf',
    label: 'HuggingFace',
    base: 'https://huggingface.co/Xenova/bge-small-zh-v1.5/resolve/main/onnx/',
    speedGate: false,
  },
  {
    id: 'mirror',
    label: '国内镜像',
    base: 'https://hf-mirror.com/Xenova/bge-small-zh-v1.5/resolve/main/onnx/',
    speedGate: true,
  },
  {
    id: 'cos',
    label: 'COS 备用',
    base: 'https://yicunxiao-1310867548.cos.ap-guangzhou.myqcloud.com/expert-role/models/bge-small-zh-v1.5/',
    speedGate: false,
  },
]

// 镜像要过速度门槛：低于这个值下 95MB 超过一分半，不如直接用 COS。
export const MIN_SPEED = 1.5 * 1024 * 1024

function withTimeout(ms) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return { signal: controller.signal, done: () => clearTimeout(timer) }
}

export async function probeUrl(url, { fetchImpl = fetch, timeoutMs = 4000 } = {}) {
  const gate = withTimeout(timeoutMs)
  try {
    const res = await fetchImpl(url, { method: 'HEAD', signal: gate.signal })
    const length = Number(res.headers?.get?.('content-length') ?? 0) || 0
    return { ok: res.ok || res.status === 206 || res.status === 302, status: res.status, length }
  } catch (error) {
    return { ok: false, status: 0, error: String(error?.message || error) }
  } finally {
    gate.done()
  }
}

// 取前若干字节测速；不支持 Range 的服务会退化成整体超时，按失败处理。
export async function measureSpeed(url, { fetchImpl = fetch, bytes = 1 << 20, timeoutMs = 8000 } = {}) {
  const gate = withTimeout(timeoutMs)
  const started = Date.now()
  try {
    const res = await fetchImpl(url, { headers: { Range: `bytes=0-${bytes - 1}` }, signal: gate.signal })
    if (!res.ok && res.status !== 206) return { ok: false, bytesPerSec: 0, status: res.status }
    let got = 0
    if (res.body?.getReader) {
      const reader = res.body.getReader()
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        got += value?.length || 0
        if (got >= bytes) {
          try {
            await reader.cancel()
          } catch {}
          break
        }
      }
    } else {
      const buf = await res.arrayBuffer()
      got = buf.byteLength
    }
    const ms = Math.max(1, Date.now() - started)
    return { ok: got > 0, bytesPerSec: Math.round((got / ms) * 1000), status: res.status }
  } catch (error) {
    return { ok: false, bytesPerSec: 0, error: String(error?.message || error) }
  } finally {
    gate.done()
  }
}

// 按「国外源 → 镜像（过速）→ COS」返回第一个可用来源。
export async function pickSource({
  fetchImpl = fetch,
  timeoutMs = 4000,
  minSpeed = MIN_SPEED,
  sources = SOURCES,
  files = MODEL_FILES,
} = {}) {
  const tried = []
  for (const source of sources) {
    const url = source.base + files[0].name
    if (source.speedGate) {
      const speed = await measureSpeed(url, { fetchImpl, timeoutMs: Math.max(timeoutMs, 8000) })
      const fast = speed.ok && speed.bytesPerSec >= minSpeed
      tried.push({ id: source.id, ok: fast, bytesPerSec: speed.bytesPerSec, why: fast ? '快' : '慢或不通' })
      if (fast) return { source, tried }
    } else {
      const probe = await probeUrl(url, { fetchImpl, timeoutMs })
      tried.push({ id: source.id, ok: probe.ok, status: probe.status })
      if (probe.ok) return { source, tried }
    }
  }
  return { source: null, tried }
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

// 下载两个文件到 dir，校验 sha256 后原子落位；失败不留半成品。
export async function downloadModel({
  dir,
  source,
  files = MODEL_FILES,
  fetchImpl = fetch,
  timeoutMs = 120000,
  onProgress = null,
} = {}) {
  if (!source) throw new Error('没有可用的下载源')
  await mkdir(dir, { recursive: true })
  const tmpDir = join(dir, '.tmp')
  await mkdir(tmpDir, { recursive: true })
  const written = []
  for (const file of files) {
    const url = source.base + file.name
    const gate = withTimeout(timeoutMs)
    let buffer = null
    try {
      const res = await fetchImpl(url, { signal: gate.signal })
      if (!res.ok) throw new Error(`${file.name} 下载失败：HTTP ${res.status}`)
      const total = Number(res.headers?.get?.('content-length') ?? 0) || file.size
      const chunks = []
      let got = 0
      if (res.body?.getReader) {
        const reader = res.body.getReader()
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          chunks.push(Buffer.from(value))
          got += value?.length || 0
          if (onProgress) onProgress({ name: file.name, got, total })
        }
      } else {
        const buf = Buffer.from(await res.arrayBuffer())
        chunks.push(buf)
        got = buf.length
        if (onProgress) onProgress({ name: file.name, got, total })
      }
      buffer = Buffer.concat(chunks)
    } finally {
      gate.done()
    }
    const digest = sha256(buffer)
    if (digest !== file.sha256) throw new Error(`${file.name} 校验不过：${digest}`)
    const part = join(tmpDir, `${file.name}.part`)
    await writeFile(part, buffer)
    await rename(part, join(dir, file.name))
    written.push(file.name)
  }
  await rm(tmpDir, { recursive: true, force: true })
  return { dir, files: written, source: source.id }
}

export async function modelDirReady(dir) {
  try {
    const onnx = await stat(join(dir, 'model-fp32.onnx'))
    const vocab = await stat(join(dir, 'vocab.txt'))
    return onnx.size > 1024 * 1024 && vocab.size > 1024
  } catch {
    return false
  }
}
