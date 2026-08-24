import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const cacheFile = path.join(root, 'data', 'cache', 'naver-places.json')
const successTtl = 72 * 60 * 60 * 1000
const failureTtl = 60 * 60 * 1000

function normalize(value) {
  return value.replace(/[^가-힣a-z0-9]/gi, '').toLowerCase()
}

async function readCache() {
  try {
    return JSON.parse(await readFile(cacheFile, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return {}
    throw error
  }
}

async function writeCache(cache) {
  await mkdir(path.dirname(cacheFile), { recursive: true })
  await writeFile(cacheFile, `${JSON.stringify(cache, null, 2)}\n`, 'utf8')
}

function findSearchItems(html) {
  const items = []
  const states = html.matchAll(/window\.__RQ_STREAMING_STATE__\.push\((\{[\s\S]*?\})\);/g)

  for (const stateMatch of states) {
    try {
      const state = JSON.parse(stateMatch[1])
      for (const query of state.queries ?? []) {
        const data = query.state?.data
        if (Array.isArray(data?.items)) items.push(...data.items)
      }
    } catch {
      // Ignore unrelated streaming-state blocks.
    }
  }

  return items
}

async function searchNaverPlace(name) {
  const query = encodeURIComponent(`${name} 부산`)
  const response = await fetch(`https://m.map.naver.com/search2/search.naver?query=${query}&sm=hty&style=v5`, {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; BusanRamenGuide/1.0)' },
    signal: AbortSignal.timeout(4000),
  })
  if (!response.ok) throw new Error(`Naver Place search failed with ${response.status}`)

  const candidates = findSearchItems(await response.text())
  const exact = candidates.find((item) =>
    typeof item.name === 'string'
    && normalize(item.name).includes(normalize(name))
    && `${item.roadAddress ?? ''} ${item.address ?? ''}`.includes('부산'),
  )
  if (!exact || !Number.isFinite(exact.latitude) || !Number.isFinite(exact.longitude)) return null

  return {
    placeId: String(exact.id),
    name: exact.name,
    address: exact.roadAddress || exact.address,
    coordinates: { lat: exact.latitude, lng: exact.longitude },
    naverPlaceUrl: `https://m.place.naver.com/place/${exact.id}/home`,
  }
}

export async function resolveNaverPlaces(names) {
  const cache = await readCache()
  const results = {}
  let nextIndex = 0

  async function worker() {
    while (nextIndex < names.length) {
      const name = names[nextIndex]
      nextIndex += 1
      const cached = cache[name]
      const ttl = cached?.result ? successTtl : failureTtl

      if (cached && Date.now() - Date.parse(cached.checkedAt) < ttl) {
        results[name] = cached.result
        continue
      }

      try {
        const result = await searchNaverPlace(name)
        cache[name] = { checkedAt: new Date().toISOString(), result }
        results[name] = result
      } catch {
        cache[name] = { checkedAt: new Date().toISOString(), result: null }
        results[name] = null
      }
    }
  }

  await Promise.all(Array.from({ length: 4 }, () => worker()))
  const cacheEntries = Object.entries(cache)
  if (cacheEntries.length > 1_000) {
    cacheEntries.sort(([, left], [, right]) => Date.parse(right.checkedAt) - Date.parse(left.checkedAt))
    for (const [name] of cacheEntries.slice(1_000)) delete cache[name]
  }
  await writeCache(cache)
  return results
}
