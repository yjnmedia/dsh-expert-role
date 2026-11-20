// 本地小模型向量：BGE-small-zh + onnxruntime-node（CPU）。不联网。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/
const PUNCT = /[\u3000-\u303f\uff00-\uffef!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g

function basicTokens(text) {
  const out = []
  const norm = String(text || '').replace(/[\u0000-\u001f]/g, ' ').normalize('NFKC')
  for (let part of norm.split(/\s+/)) {
    if (!part) continue
    part = part.replace(PUNCT, ' ')
    for (const chunk of part.split(/\s+/)) {
      if (!chunk) continue
      let buf = ''
      for (const ch of chunk) {
        if (CJK.test(ch)) {
          if (buf) { out.push(buf); buf = '' }
          out.push(ch)
        } else buf += ch
      }
      if (buf) out.push(buf)
    }
  }
  return out
}

function loadVocab(file) {
  const map = new Map()
  const lines = fs.readFileSync(file, 'utf8').split('\n')
  for (let i = 0; i < lines.length; i += 1) {
    const w = lines[i].replace(/\r$/, '')
    if (w) map.set(w, i)
  }
  return map
}

function wordPiece(token, vocab, maxChars = 100) {
  const pieces = []
  let start = 0
  while (start < token.length) {
    let end = token.length
    let cur = null
    while (start < end) {
      const piece = (start === 0 ? '' : '##') + token.slice(start, end)
      if (vocab.has(piece)) { cur = piece; break }
      end -= 1
      if (end - start > maxChars) break
    }
    if (!cur) return ['[UNK]']
    pieces.push(cur)
    start = end
  }
  return pieces
}

export function createTokenizer(vocabPath) {
  const vocab = loadVocab(vocabPath)
  const unk = vocab.get('[UNK]') ?? 100
  const cls = vocab.get('[CLS]') ?? 101
  const sep = vocab.get('[SEP]') ?? 102
  const pad = vocab.get('[PAD]') ?? 0
  return function encode(text, maxLen = 256) {
    const ids = [cls]
    for (const t of basicTokens(text)) {
      for (const p of wordPiece(t.toLowerCase(), vocab)) {
        const id = vocab.get(p)
        ids.push(id === undefined ? unk : id)
        if (ids.length >= maxLen - 1) break
      }
      if (ids.length >= maxLen - 1) break
    }
    ids.push(sep)
    const len = ids.length
    while (ids.length < maxLen) ids.push(pad)
    const mask = new Array(maxLen).fill(0)
    for (let i = 0; i < len; i += 1) mask[i] = 1
    return { ids, mask, len }
  }
}

export async function createEmbedder({ modelPath, vocabPath }) {
  const ort = await import('onnxruntime-node')
  const encode = createTokenizer(vocabPath)
  const session = await ort.InferenceSession.create(modelPath, { intraOpNumThreads: 2 })
  const inputNames = session.inputNames
  const MAX = 256
  async function embed(texts) {
    const list = Array.isArray(texts) ? texts : [texts]
    const out = []
    for (const text of list) {
      const { ids, mask } = encode(text, MAX)
      const feeds = {}
      for (const name of inputNames) {
        if (name === 'input_ids') feeds[name] = new ort.Tensor('int64', BigInt64Array.from(ids.map(BigInt)), [1, MAX])
        else if (name === 'attention_mask') feeds[name] = new ort.Tensor('int64', BigInt64Array.from(mask.map(BigInt)), [1, MAX])
        else if (name === 'token_type_ids') feeds[name] = new ort.Tensor('int64', new BigInt64Array(MAX), [1, MAX])
      }
      const res = await session.run(feeds)
      const first = res[session.outputNames[0]]
      const dims = first.dims
      const hidden = dims[dims.length - 1]
      const data = first.data
      const vec = new Float32Array(hidden)
      const rows = dims.length === 3 ? dims[1] : 1
      // BGE 系列用 [CLS] 池化（官方说明），不是平均池化。
      for (let h = 0; h < hidden; h += 1) vec[h] = data[h]
      let norm = 0
      for (let h = 0; h < hidden; h += 1) norm += vec[h] * vec[h]
      norm = Math.sqrt(norm) || 1
      for (let h = 0; h < hidden; h += 1) vec[h] /= norm
      out.push(vec)
    }
    return out
  }
  return { embed, dims: 512 }
}

export function cosine(a, b) {
  let s = 0
  for (let i = 0; i < a.length; i += 1) s += a[i] * b[i]
  return s
}

// 模型放在插件自己的 models/ 下；默认按本文件位置解析，
// 不依赖宿主进程的工作目录（插件是 link 安装的，cwd 可能是 DSH 安装目录）。
export const DEFAULT_MODEL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export function modelPaths(baseDir = DEFAULT_MODEL_DIR) {
  return {
    modelPath: path.join(baseDir, 'models/bge-small-zh/model-fp32.onnx'),
    vocabPath: path.join(baseDir, 'models/bge-small-zh/vocab.txt'),
  }
}
