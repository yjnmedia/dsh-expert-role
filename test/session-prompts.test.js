import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { parsePrompts, loadPrompts } from '../lib/session-prompts.js'

const DOC = fileURLToPath(new URL('../docs/session-prompts.md', import.meta.url))

test('提示词文档能解析出八段，且每段都带编号标题', async () => {
  const { list, opening } = await loadPrompts(DOC)
  assert.ok(opening.length > 10, '首条消息那一句没解析出来')
  assert.equal(list.length, 8)
  assert.deepEqual(
    list.map((item) => item.index),
    ['01', '02', '03', '04', '05', '06', '07', '08'],
  )
  for (const item of list) {
    assert.ok(item.title.startsWith(item.index), `${item.title} 缺少编号`)
    assert.ok(item.prompt.length > 200, `${item.title} 正文太短，可能解析错`)
    assert.ok(!item.prompt.includes('```'), `${item.title} 里混进了代码围栏`)
  }
})

test('不带编号的章节（首条消息）不会被当成大类', () => {
  const md = ['## 01 甲类', '```text', '甲的内容', '```', '## 首条消息统一附一句', '```text', '回执', '```'].join('\n')
  const list = parsePrompts(md)
  assert.equal(list.length, 1)
  assert.equal(list[0].title, '01 甲类')
})

test('少于八段时直接报错，不静默少建', async () => {
  await assert.rejects(() => loadPrompts(fileURLToPath(new URL('./fixtures/not-enough.md', import.meta.url))))
})
