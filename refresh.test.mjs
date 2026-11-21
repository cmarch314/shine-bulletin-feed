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
  assert.deepEqual(catalog.issues.map(i => i.date), ['2026-11-15', '2026-11-08', '2026-11-01'])
  assert.deepEqual(catalog.issues[0].pages.map(p => p.src.split('/').at(-1)), ['9.png', '2.png'])
  assert.doesNotMatch(JSON.stringify(catalog), /not a catalog field/)
})
test('rejects non-official destinations and mixed attachments', () => {
  for (const item of [
    { ...post(8, 1000001), permalink: 'https://example.com/_WqHGb/1000001' },
    { ...post(8, 1000001), media: [{ type: 'video' }] },
  ]) assert.throws(() => catalogFromKakao({ items: [item] }, now))
})

test('includes the shortened Sunday bulletin title but not weekday or unrelated announcements', () => {
  const short = (day, id) => ({ ...post(day, id), title: `2026년 11월 ${day}일 주` })
  const catalog = catalogFromKakao({ items: [
    short(15, 1000004), short(16, 1000005),
    { ...post(15, 1000006), title: '2026년 11월 15일 주일 공지' },
    { ...short(22, 1000007), is_private: true },
    short(29, 1000008), post(8, 1000001),
  ] }, new Date('2026-11-24T16:00:00Z'))
  assert.deepEqual(catalog.issues.map(i => i.date), ['2026-11-29', '2026-11-15', '2026-11-08'])
  assert.deepEqual(catalog.issues[0].pages.map(p => p.src.split('/').at(-1)), ['9.png', '2.png'])
})

test('on Friday both public Sunday title formats are eligible, but scheduled, unlisted and far-future posts are not', () => {
  const friday = new Date('2026-11-21T02:31:00Z') // Friday evening in LA
  for (const suffix of ['주보', '주']) {
    const latest = { ...post(22, 1000022), title: '2026년 11월 22일 ' + suffix }
    const base = [post(15, 1000015), post(29, 1000029), post(23, 1000023)]
    const dates = (extra) => catalogFromKakao({ items: [...base, extra] }, friday).issues.map(i => i.date)
    assert.deepEqual(dates(latest), ['2026-11-22', '2026-11-15'])
    for (const hidden of [{ status: 'scheduled' }, { is_private: true }, { unlisted: true }, { publish_to: 0 }])
      assert.deepEqual(dates({ ...latest, ...hidden }), ['2026-11-15'])
  }
})

test('early publication window crosses New Year using the Los Angeles date', () => {
  const jan = { ...post(1, 1000001), title: '2027년 1월 3일 주보' }
  const source = { items: [jan, post(1, 1000002)] }
  assert.equal(catalogFromKakao(source, new Date('2026-12-27T07:59:00Z')).issues[0].date, '2026-11-01')
  assert.equal(catalogFromKakao(source, new Date('2026-12-27T08:00:00Z')).issues[0].date, '2027-01-03')
})
