import assert from 'node:assert/strict'
import { test } from 'node:test'
import { catalogFromKakao } from './refresh.mjs'

const image = suffix => ({ type: 'card', medium: {
  type: 'image', url: 'https://k.kakaocdn.net/test/' + suffix, mimetype: 'image/png', width: 720, height: 960,
} })
const post = (day, id) => ({
  title: `2026년 11월 ${day}일 주보`, permalink: 'http://pf.kakao.com/_WqHGb/' + id,
  publish_to: 1, status: 'published', is_private: false, unlisted: false, adult_only: false,
  media: [image('9.png'), image('2.png')], contents: 'not a catalog field',
})
const now = new Date('2026-11-10T16:00:00Z')
test('preserves public source order inside each issue and dates across issues', () => {
  const catalog = catalogFromKakao({ items: [
    post(1, 1000000), post(8, 1000001), post(15, 1000002), { ...post(9, 1000003), is_private: true },
  ] }, now)
  assert.deepEqual(catalog.issues.map(i => i.date), ['2026-11-08', '2026-11-01'])
  assert.deepEqual(catalog.issues[0].pages.map(p => p.src.split('/').at(-1)), ['9.png', '2.png'])
  assert.doesNotMatch(JSON.stringify(catalog), /not a catalog field/)
})
test('rejects non-official destinations and mixed attachments', () => {
  for (const item of [
    { ...post(8, 1000001), permalink: 'https://example.com/_WqHGb/1000001' },
    { ...post(8, 1000001), media: [{ type: 'video' }] },
  ]) assert.throws(() => catalogFromKakao({ items: [item] }, now))
})
