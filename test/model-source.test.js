import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import {
  MODEL_FILES,
  SOURCES,
  MIN_SPEED,
  pickSource,
  measureSpeed,
  downloadModel,
  modelDirReady,
} from '../lib/model-source.js'

const onnx = MODEL_FILES[0]
const vocab = MODEL_FILES[1]

function okHead(status = 200) {
  return {
    ok: status < 400,
    status,
    headers: { get: () => '100' },
  }
}

function readerOf(chunkSize, count) {
  let sent = 0
  return {
    getReader() {
      return {
        async read() {
          if (sent >= count) return { done: true, value: undefined }
          sent += 1
          return { done: false, value: new Uint8Array(chunkSize) }
        },
        async cancel() {},
      }
    },
  }
}

test('国外源通就先用它，不碰镜像和 COS', async () => {
  const seen = []
  const fetchImpl = async (url, init) => {
    seen.push(String(url))
    return okHead(200)
  }
  const picked = await pickSource({ fetchImpl })
  assert.equal(picked.source.id, 'hf')
  assert.equal(seen.length, 1)
})

test('国外源不通、镜像够快就用镜像', async () => {
  const fetchImpl = async (url, init) => {
    if (String(url).includes('huggingface.co')) throw new Error('blocked')
    return { ...okHead(206), body: readerOf(256 * 1024, 8) }
  }
  const picked = await pickSource({ fetchImpl, minSpeed: 0 })
  assert.equal(picked.source.id, 'mirror')
})

test('镜像太慢就落到 COS', async () => {
  const fetchImpl = async (url) => {
    const u = String(url)
    if (u.includes('huggingface.co')) throw new Error('blocked')
    if (u.includes('hf-mirror')) return { ...okHead(206), body: readerOf(1024, 1) }
    return okHead(200)
  }
  const picked = await pickSource({ fetchImpl })
  assert.equal(picked.source.id, 'cos')
  assert.ok(picked.tried.some((item) => item.id === 'mirror' && !item.ok))
})

test('三个源都不通时返回空，给出尝试记录', async () => {
  const fetchImpl = async () => {
    throw new Error('offline')
  }
  const picked = await pickSource({ fetchImpl })
  assert.equal(picked.source, null)
  assert.equal(picked.tried.length, SOURCES.length)
})

test('测速把字节数换算成每秒字节', async () => {
  const fetchImpl = async () => ({ ...okHead(206), body: readerOf(64 * 1024, 4) })
  const speed = await measureSpeed('https://example.com/x', { fetchImpl })
  assert.equal(speed.ok, true)
  assert.ok(speed.bytesPerSec > 0)
})

test('下载校验 sha256 后落位，临时目录被清掉', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'model-'))
  try {
    const payload = {
      'model-fp32.onnx': Buffer.from('onnx-bytes'),
      'vocab.txt': Buffer.from('vocab-bytes'),
    }
    const files = Object.keys(payload).map((name) => ({
      name,
      size: payload[name].length,
      sha256: createHash('sha256').update(payload[name]).digest('hex'),
    }))
    const fetchImpl = async (url) => {
      const name = String(url).split('/').pop()
      return {
        ok: true,
        status: 200,
        headers: { get: () => String(payload[name].length) },
        body: null,
        async arrayBuffer() {
          return payload[name]
        },
      }
    }
    const result = await downloadModel({ dir, source: SOURCES[2], files, fetchImpl })
    assert.deepEqual(result.files.sort(), Object.keys(payload).sort())
    assert.equal((await readFile(join(dir, 'vocab.txt'), 'utf8')), 'vocab-bytes')
    const left = await readdir(dir)
    assert.deepEqual(left.sort(), Object.keys(payload).sort())
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('校验不过就报错，不留成品文件', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'model-'))
  try {
    const files = [{ name: 'vocab.txt', size: 3, sha256: 'deadbeef' }]
    const fetchImpl = async () => ({
      ok: true,
      status: 200,
      headers: { get: () => '3' },
      body: null,
      async arrayBuffer() {
        return Buffer.from('abc')
      },
    })
    await assert.rejects(() => downloadModel({ dir, source: SOURCES[2], files, fetchImpl }), /校验不过/)
    const left = await readdir(dir)
    assert.equal(left.includes('vocab.txt'), false)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('目录里有真文件才算装好', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'model-'))
  try {
    assert.equal(await modelDirReady(dir), false)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
  assert.equal(MIN_SPEED, 1.5 * 1024 * 1024)
  assert.equal(onnx.name, 'model-fp32.onnx')
  assert.equal(vocab.name, 'vocab.txt')
})
