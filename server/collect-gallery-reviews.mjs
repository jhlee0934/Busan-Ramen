import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const candidates = JSON.parse(await readFile(path.join(root, 'data', 'community-candidates.json'), 'utf8'))
const aliases = JSON.parse(await readFile(path.join(root, 'data', 'community-aliases.json'), 'utf8'))
const outputFile = path.join(root, 'data', 'community-reviews.json')
const listUrl = 'https://gall.dcinside.com/mgallery/board/lists/?id=busanramen&search_head=10'
const viewUrl = (postId) => `https://gall.dcinside.com/mgallery/board/view/?id=busanramen&no=${postId}`
const collectionWindowDays = 31
const collectionWindowMs = collectionWindowDays * 24 * 60 * 60 * 1000
const crawlDelayMs = Math.max(500, Number(process.env.CRAWL_DELAY_MS ?? 1000))

function decodeHtml(value) {
  return value.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ').replaceAll('&nbsp;', ' ')
    .replaceAll('&quot;', '"').replaceAll('&#039;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&').replace(/\s+/g, ' ').trim()
}

export function matchingRestaurants(text) {
  const normalized = text.toLowerCase().replace(/\s+/g, '')
  return candidates.candidates.filter((candidate) => [candidate.name, ...(candidate.aliases ?? []), ...(aliases.restaurantAliases[candidate.name] ?? [])]
    .filter((name) => name.replace(/\s+/g, '').length >= 2)
    .some((name) => normalized.includes(name.toLowerCase().replace(/\s+/g, '')))).map((candidate) => candidate.name)
}

export function expandMenuAliases(text) {
  let expanded = text
  for (const [alias, menu] of Object.entries(aliases.menuAliases)) {
    expanded = expanded.replaceAll(alias, `${alias}(${menu})`)
  }
  return expanded
}

function parseListRows(html) {
  const rows = []
  for (const row of html.matchAll(/<tr class="ub-content us-post"[\s\S]*?<\/tr>/g)) {
    const block = row[0]
    const postId = Number(block.match(/data-no="(\d+)"/)?.[1])
    const titleHtml = block.match(/<td class="gall_tit ub-word">[\s\S]*?<a[^>]+>([\s\S]*?)<\/a>/)?.[1]
    const publishedAt = block.match(/<td class="gall_date" title="(\d{4}-\d{2}-\d{2})/)?.[1]
    if (postId && titleHtml && publishedAt) rows.push({ postId, title: decodeHtml(titleHtml), publishedAt })
  }
  return rows
}

function extractBody(html) {
  const body = html.match(/<div class="write_div"[^>]*>([\s\S]*?)<\/div>\s*<div class="view_bottom_btnbox/)?.[1]
  const description = html.match(/<meta name="description" content="([\s\S]*?)">/)?.[1]
  return decodeHtml(body || description || '')
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; BusanRamenGuide/1.0)' },
    signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) throw new Error(`Request failed with ${response.status}: ${url}`)
  return response.text()
}

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

export async function collectGalleryReviews({ now = new Date(), maxPages = 200 } = {}) {
  const cutoff = new Date(now.getTime() - collectionWindowMs)
  const posts = []
  for (let page = 1; page <= maxPages; page += 1) {
    const rows = parseListRows(await fetchText(`${listUrl}&page=${page}`))
    if (rows.length === 0) break
    const inRange = rows.filter((row) => new Date(`${row.publishedAt}T23:59:59+09:00`) >= cutoff)
    posts.push(...inRange)
    if (inRange.length < rows.length) break
  }

  if (posts.length === 0) throw new Error('Gallery review list was unavailable; existing corpus was preserved')

  let previous = { reviews: [] }
  try {
    previous = JSON.parse(await readFile(outputFile, 'utf8'))
  } catch {
    // The first collection has no previous corpus.
  }
  const postIds = new Set(posts.map((post) => post.postId))
  const reviews = previous.reviews.filter((review) => postIds.has(review.postId) && Array.isArray(review.restaurantNames))
  const completedIds = new Set(previous.processedPostIds ?? reviews.map((review) => review.postId))
  const pendingPosts = posts.filter((post) => !completedIds.has(post.postId))
  let nextIndex = 0
  async function worker() {
    while (nextIndex < pendingPosts.length) {
      const post = pendingPosts[nextIndex]
      nextIndex += 1
      try {
        await sleep(crawlDelayMs)
        const body = extractBody(await fetchText(viewUrl(post.postId)))
        const restaurantNames = matchingRestaurants(`${post.title} ${body}`)
        if (body && restaurantNames.length > 0) reviews.push({ ...post, restaurantNames, body: expandMenuAliases(body), url: viewUrl(post.postId) })
        completedIds.add(post.postId)
      } catch {
        // The post remains pending and will be retried by the next collection.
      }
    }
  }
  await worker()
  reviews.sort((left, right) => right.postId - left.postId)

  if (reviews.length === 0) throw new Error('Gallery returned no matching reviews; existing corpus was preserved')
  const payload = {
    collectedAt: new Date().toISOString(),
    range: { from: cutoff.toISOString(), to: now.toISOString() },
    collectionWindowDays,
    source: listUrl,
    scannedReviewPostCount: posts.length,
    fetchedReviewPostCount: completedIds.size,
    failedReviewPostCount: posts.length - completedIds.size,
    processedPostIds: [...completedIds].sort((left, right) => right - left),
    reviews,
  }
  await writeFile(outputFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  return payload
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const payload = await collectGalleryReviews()
  console.log(`Collected ${payload.reviews.length} matching reviews from ${payload.scannedReviewPostCount} review posts.`)
}
