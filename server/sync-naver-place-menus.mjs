import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const file = path.join(root, 'data', 'restaurants.json')
const restaurants = JSON.parse(await readFile(file, 'utf8'))
const checkedAt = new Date().toISOString().slice(0, 10)

function getApolloState(html) {
  const marker = 'window.__APOLLO_STATE__ = '
  const start = html.indexOf(marker)
  if (start < 0) return null
  const jsonStart = start + marker.length
  const jsonEnd = html.indexOf(';', jsonStart)
  if (jsonEnd < 0) return null
  return JSON.parse(html.slice(jsonStart, jsonEnd))
}

async function getPlaceId(name) {
  const query = encodeURIComponent(`${name} 부산`)
  const response = await fetch(`https://m.map.naver.com/search2/search.naver?query=${query}&sm=hty&style=v5`, { signal: AbortSignal.timeout(8000) })
  if (!response.ok) return null
  const html = await response.text()
  const match = html.match(/href="https:\/\/m\.place\.naver\.com\/place\/(\d+)\/home"[\s\S]{0,500}?<strong[^>]*>([^<]+)<\/strong>/)
  if (!match) return null
  const normalize = (value) => value.replace(/[^가-힣a-z0-9]/gi, '').toLowerCase()
  return normalize(match[2]).includes(normalize(name)) ? match[1] : null
}

async function getMenus(placeId) {
  const response = await fetch(`https://m.place.naver.com/place/${placeId}/menu/list`, { signal: AbortSignal.timeout(8000) })
  if (!response.ok) return []
  const state = getApolloState(await response.text())
  if (!state) return []

  return Object.entries(state)
    .filter(([key, value]) => key.startsWith('Menu:') && value?.name)
    .map(([, value]) => ({
      name: value.name.trim(),
      price: Number(String(value.price ?? '').replace(/[^0-9]/g, '')),
      description: value.description?.trim() || `${value.name.trim()} 대표 메뉴`,
      recommended: value.recommend === true,
      priority: Number.isFinite(value.priority) ? value.priority : Number.MAX_SAFE_INTEGER,
    }))
    .filter((menu) => menu.name && Number.isInteger(menu.price) && menu.price > 0)
    .sort((left, right) => Number(right.recommended) - Number(left.recommended) || left.priority - right.priority)
    .slice(0, 3)
    .map(({ name, price, description }) => ({ name, price, description }))
}

let updated = 0
let nextIndex = 0
async function worker() {
  while (nextIndex < restaurants.length) {
    const restaurant = restaurants[nextIndex]
    nextIndex += 1
  try {
    const placeId = await getPlaceId(restaurant.name)
    if (!placeId) continue
    const menus = await getMenus(placeId)
    restaurant.mapLinks.naver = `https://m.place.naver.com/place/${placeId}/home`
    if (menus.length === 0) continue
    restaurant.signatureMenus = menus
    restaurant.sources = restaurant.sources.filter((source) => !source.title.endsWith('네이버 플레이스 메뉴'))
    restaurant.sources.push({
      title: `${restaurant.name} 네이버 플레이스 메뉴`,
      url: `https://m.place.naver.com/place/${placeId}/menu/list`,
      publishedOrCheckedAt: checkedAt,
      supports: '대표 메뉴명, 가격, 메뉴 설명',
    })
    updated += 1
  } catch (error) {
    console.warn(`Skipped ${restaurant.name}: ${error.message}`)
  }
  }
}

await Promise.all(Array.from({ length: 4 }, () => worker()))

await writeFile(file, `${JSON.stringify(restaurants, null, 2)}\n`, 'utf8')
console.log(`Updated Naver Place menus for ${updated} restaurants.`)
