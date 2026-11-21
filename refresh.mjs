import { readFile, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const publicFeed = 'https://pf.kakao.com/rocket-web/web/v2/profiles/_WqHGb/posts?includePinnedPost=true'
const output = new URL('./catalog.json', import.meta.url)
const dateParts = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit',
})
const textLimit = 900_000

function issueDate(title) {
  const match = typeof title === 'string' && /^\s*(20\d{2})년\s*(\d{1,2})월\s*(\d{1,2})일\s*주(보)?\s*$/.exec(title.normalize('NFKC'))
  if (!match) return ''
  const date = [match[1], match[2].padStart(2, '0'), match[3].padStart(2, '0')].join('-')
  const parsed = new Date(date + 'T00:00:00Z')
  return Number.isFinite(+parsed) && parsed.toISOString().slice(0, 10) === date &&
    (match[4] || parsed.getUTCDay() === 0) ? date : ''
}

export function catalogFromKakao(payload, now = new Date()) {
  if (!Array.isArray(payload?.items) || payload.items.length > 60) throw Error('Unexpected list.')
  const parts = dateParts.formatToParts(now)
  const today = ['year', 'month', 'day'].map(type => parts.find(part => part.type === type).value).join('-')
  // The title is a service date, not a publication date. A listed Sunday
  // bulletin can already be public during the week before the service.
  const horizon = new Date(today + 'T00:00:00Z')
  horizon.setUTCDate(horizon.getUTCDate() + 7)
  const lastServiceDate = horizon.toISOString().slice(0, 10)
  const dates = new Set()
  const sources = new Set()
  const issues = payload.items
    .filter(post => post?.status === 'published' && post.publish_to === 1 &&
      post.is_private === false && post.unlisted === false && post.adult_only === false)
    .map(post => ({ post, date: issueDate(post.title) }))
    .filter(({ date }) => date && (date <= today ||
      (date <= lastServiceDate && new Date(date + 'T00:00:00Z').getUTCDay() === 0)))
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 20)
    .map(({ post, date }) => {
      if (dates.has(date)) throw Error('Duplicate issue date.')
      dates.add(date)
      const url = new URL(post.permalink, 'https://pf.kakao.com')
      if (url.protocol === 'http:' && url.host === 'pf.kakao.com') url.protocol = 'https:'
      const source = url.href
      if (sources.has(source) || !/^https:\/\/pf\.kakao\.com\/_WqHGb\/[1-9]\d{5,14}$/.test(source))
        throw Error('Unexpected source address.')
      sources.add(source)
      if (!Array.isArray(post.media) || post.media.length < 1 || post.media.length > 20)
        throw Error('Unexpected attachment count.')
      const pages = post.media.map(card => {
        const medium = card?.medium
        if (card?.type !== 'card' || medium?.type !== 'image' ||
          !['image/png', 'image/jpeg', 'image/webp'].includes(medium.mimetype) ||
          typeof medium.url !== 'string' || medium.url.length > 1024 ||
          !/^https:\/\/k\.kakaocdn\.net\/[A-Za-z0-9_./@%~-]+$/.test(medium.url) ||
          ![medium.width, medium.height].every(x => Number.isInteger(x) && x >= 16 && x <= 5000))
          throw Error('Unexpected attachment.')
        return { src: medium.url, width: medium.width, height: medium.height }
      })
      return { date, source, pages }
    })
  if (issues.length < 1) throw Error('No validated dated public issues.')
  return { checkedAt: now.toISOString(), issues }
}

async function refresh() {
  const response = await fetch(publicFeed, {
    signal: AbortSignal.timeout(12000), credentials: 'omit', redirect: 'error',
    headers: { Accept: 'application/json' },
  })
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json') || !response.body)
    throw Error('Source unavailable.')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let size = 0
  let body = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > textLimit) {
      await reader.cancel()
      throw Error('Source response too large.')
    }
    body += decoder.decode(value, { stream: true })
  }
  const catalog = catalogFromKakao(JSON.parse(body + decoder.decode()))
  let old
  try { old = JSON.parse(await readFile(output, 'utf8')) }
  catch (error) { if (error.code !== 'ENOENT') throw error }
  if (JSON.stringify(old?.issues) !== JSON.stringify(catalog.issues)) {
    // Only the allowlisted data projection is persisted. The original payload
    // (including text, buttons, and account info) is never written or logged.
    await writeFile(output, JSON.stringify(catalog, null, 2) + '\n', 'utf8')
  }
  console.log(`Validated ${catalog.issues.length} issues; latest ${catalog.issues[0].date} (${catalog.issues[0].pages.length} pages).`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  refresh().catch(() => {
    console.error('Bulletin refresh failed validation; previous published catalog was retained.')
    process.exitCode = 1
  })
}
