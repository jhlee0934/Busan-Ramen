import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { geocodeAddress } from './naver-directions.mjs'

const root = path.resolve(import.meta.dirname, '..')
const file = path.join(root, 'data', 'restaurants.json')
const restaurants = JSON.parse(await readFile(file, 'utf8'))
const checkedAt = new Date().toISOString().slice(0, 10)
const knownAddresses = new Map([
  ['가솔린앤로지스', '부산광역시 부산진구 전포대로209번길 39-9 1층'],
  ['규스지커리바', '부산광역시 부산진구 동성로71번길 23 지하1층'],
  ['라멘유메', '부산광역시 부산진구 동성로49번길 38-1 1층'],
  ['나의피는라멘으로되어있어', '부산광역시 부산진구 동성로 23-2 1층'],
  ['로지라멘스탠드', '부산광역시 중구 광복중앙로34번길 12 1층 102호'],
  ['멘야토리모토', '부산광역시 연제구 중앙대로1043번길 34 1층 107호'],
  ['멘즈키', '부산광역시 부산진구 동성로49번길 34'],
  ['멘초비', '부산광역시 동래구 동래시장길 14'],
  ['복동이네오지상', '부산광역시 부산진구 서전로9번길 49 1층'],
  ['부타갱스터', '부산광역시 부산진구 동천로 51'],
  ['사이쿄우', '부산광역시 부산진구 중앙대로692번길 42 1층'],
  ['사카나라멘', '부산광역시 수영구 수영로610번길 7 1층'],
  ['숏타임푸드빠', '부산광역시 수영구 광남로258번길 23 1층'],
  ['아부라클럽', '부산광역시 남구 용소로 26 1층'],
  ['와루가키노아소비', '부산광역시 수영구 민락로6번길 23 1층 2호'],
  ['중화소바지평', '부산광역시 사상구 사상로 172 A동 1층'],
  ['카네다', '부산광역시 부산진구 동성로30번길 5 1층'],
  ['코코노카', '부산광역시 남구 수영로334번길 56-1 1층 102호'],
  ['쿠지라멘', '부산광역시 해운대구 우동2로 17'],
  ['쿠지라스토랑', '부산광역시 수영구 무학로49번길 71'],
  ['키무엔', '부산광역시 금정구 장전온천천로73번길 6 1층'],
  ['타라코소바', '부산광역시 해운대구 해운대해변로359번길 27 1층'],
  ['테우치멘이토', '부산광역시 부산진구 동성로 30'],
  ['펀치', '부산광역시 금정구 부산대학로38번길 10 1층'],
  ['충칭소면관', '부산광역시 수영구 남천바다로 13-1'],
])

for (const restaurant of restaurants) {
  const address = knownAddresses.get(restaurant.name)
  if (!address) continue
  const location = await geocodeAddress(address)
  restaurant.address = location.roadAddress || address
  restaurant.coordinates = { lat: location.lat, lng: location.lng }
  restaurant.locationPrecision = 'exact'
  restaurant.sources = restaurant.sources.filter((source) => source.title !== 'NAVER Maps Geocoding API')
  restaurant.sources.push({
    title: 'NAVER Maps Geocoding API',
    url: 'https://api.ncloud-docs.com/docs/en/application-maps-geocoding',
    publishedOrCheckedAt: checkedAt,
    supports: '확인된 도로명 주소의 위도와 경도 변환',
  })
}

await writeFile(file, `${JSON.stringify(restaurants, null, 2)}\n`, 'utf8')
console.log(`Verified ${knownAddresses.size} known restaurant locations.`)
