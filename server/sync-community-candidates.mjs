import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const dataFile = (name) => path.join(root, 'data', name)
const candidates = JSON.parse(await readFile(dataFile('community-candidates.json'), 'utf8'))
const ratings = JSON.parse(await readFile(dataFile('community-ratings.json'), 'utf8'))
const restaurants = JSON.parse(await readFile(dataFile('restaurants.json'), 'utf8'))
const today = new Date().toISOString().slice(0, 10)

const areaCenters = [
  ['부산진구', { lat: 35.1577, lng: 129.0592 }],
  ['수영구', { lat: 35.1457, lng: 129.1131 }],
  ['남구', { lat: 35.1366, lng: 129.0844 }],
  ['중구', { lat: 35.1064, lng: 129.0323 }],
  ['연제구', { lat: 35.1762, lng: 129.0798 }],
  ['동래구', { lat: 35.2048, lng: 129.0838 }],
  ['사상구', { lat: 35.1526, lng: 128.9912 }],
  ['해운대구', { lat: 35.1631, lng: 129.1635 }],
  ['금정구', { lat: 35.2300, lng: 129.0844 }],
]

function slug(index) {
  return `community-candidate-${String(index + 1).padStart(2, '0')}`
}

function getAreaCenter(area, index) {
  const center = areaCenters.find(([district]) => area.includes(district))?.[1] ?? { lat: 35.1796, lng: 129.0756 }
  const angle = index * 2.39996
  const radius = 0.004 + (index % 4) * 0.0015
  return {
    lat: Number((center.lat + Math.sin(angle) * radius).toFixed(6)),
    lng: Number((center.lng + Math.cos(angle) * radius).toFixed(6)),
  }
}

function fallbackSummary(rating) {
  const positive = rating?.positivePostIds.length ?? 0
  const negative = rating?.negativePostIds.length ?? 0
  const neutral = rating?.neutralPostIds.length ?? 0
  if (positive >= 2 && negative === 0) return `검토 게시물에서 긍정 평가가 ${positive}건 확인됐고 부정 평가는 확인되지 않았다.`
  if (positive > 0 && negative > 0) return `긍정 평가 ${positive}건과 부정 평가 ${negative}건이 함께 확인돼 의견이 엇갈린다.`
  if (negative > 0) return `검토 게시물에서 부정 또는 아쉬움 평가가 ${negative}건 확인됐으며, 중립 언급은 ${neutral}건이다.`
  return `직접적인 호불호 평가보다 목록·방문 후보 등 중립 언급 ${neutral}건이 중심이다.`
}

const existingByName = new Map(restaurants.map((restaurant) => [restaurant.name, restaurant]))
const merged = candidates.candidates.map((candidate, index) => {
  const existing = existingByName.get(candidate.name)
  const rating = ratings.ratings.find((item) => item.name === candidate.name)
  const evidence = [...new Set([
    ...candidate.evidencePostIds,
    ...(rating?.positivePostIds ?? []),
    ...(rating?.negativePostIds ?? []),
    ...(rating?.neutralPostIds ?? []),
  ])]
  const searchName = `${candidate.name} 부산`

  return {
    id: existing?.id ?? slug(index),
    name: candidate.name,
    branch: existing?.branch ?? null,
    area: existing?.area ?? candidate.area,
    address: existing?.address ?? `${candidate.area} (상세 주소 확인 중)`,
    verificationStatus: existing?.verificationStatus ?? (existing ? 'verified' : 'candidate'),
    locationPrecision: existing?.locationPrecision ?? (existing ? 'exact' : 'area'),
    nearestStation: existing?.nearestStation ?? null,
    coordinates: existing?.locationPrecision === 'area' ? getAreaCenter(candidate.area, index) : (existing?.coordinates ?? getAreaCenter(candidate.area, index)),
    ramenStyles: existing?.ramenStyles ?? [],
    ramenCategories: existing?.ramenCategories ?? ['other'],
    signatureMenus: existing?.signatureMenus ?? [],
    features: existing?.features ?? { broth: null, noodles: null, tare: null, toppings: null },
    enthusiastNote: existing?.enthusiastNote ?? fallbackSummary(rating),
    cautions: existing?.cautions ?? ['후보 매장으로 상세 주소와 영업 상태를 확인 중이다.'],
    hours: existing?.hours ?? null,
    closedDays: existing?.closedDays ?? null,
    breakTime: existing?.breakTime ?? null,
    waitingInfo: existing?.waitingInfo ?? null,
    lastVerified: existing?.lastVerified ?? today,
    mapLinks: {
      naver: existing?.mapLinks?.naver ?? `https://map.naver.com/p/search/${encodeURIComponent(searchName)}`,
      kakao: existing?.mapLinks?.kakao ?? null,
    },
    community: existing?.community ?? {
      summary: fallbackSummary(rating),
      generatedBy: 'rating-fallback',
      updatedAt: today,
      evidencePostIds: evidence,
    },
    sources: existing?.sources ?? candidate.evidencePostIds.slice(0, 2).map((postId) => ({
      title: `부산 라멘 마이너 갤러리 게시물 ${postId}`,
      url: candidates.evidencePosts[postId],
      publishedOrCheckedAt: today,
      supports: '가게 언급 및 커뮤니티 평가 근거',
    })),
  }
})

await writeFile(dataFile('restaurants.json'), `${JSON.stringify(merged, null, 2)}\n`, 'utf8')
console.log(`Synced ${merged.length} community candidates.`)
