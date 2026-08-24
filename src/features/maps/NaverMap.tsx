import { useEffect, useMemo, useRef, useState } from 'react'
import ratingsData from '../../../data/community-ratings.json'
import type { RamenCategory, Restaurant } from '../restaurants/types'
import { geocodeAddress, geocodeWithMapSdk, getMapClientId, resolveNaverPlaces, type Coordinates } from './map-api'

type RatingTier = 'high' | 'medium' | 'low' | 'unrated'
type MappedRestaurant = Restaurant & { coordinates: Coordinates; ratingTier: RatingTier }
const defaultCenter: Coordinates = { lat: 35.1796, lng: 129.0756 }
const categoryLabels: Record<'all' | RamenCategory, string> = { all: '전체', chintan: '청탕', paitan: '백탕', jiro: '지로', tsukemen: '츠케멘', abura: '아부라/마제', other: '기타' }

function getRatingTier(name: string): RatingTier {
  const tier = ratingsData.ratings.find((item) => item.name === name)?.tier
  return tier === 'high' || tier === 'medium' || tier === 'low' ? tier : 'unrated'
}

function withCoordinates(restaurant: Restaurant): MappedRestaurant | null {
  return restaurant.coordinates ? { ...restaurant, coordinates: restaurant.coordinates, ratingTier: getRatingTier(restaurant.name) } : null
}

function appendNaverMapScript(clientId: string, parameter: 'ncpKeyId' | 'ncpClientId') {
  const selector = `script[data-naver-map-sdk="${parameter}"]`
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(selector)
    if (existing) {
      if (window.naver?.maps) return resolve()
      existing.remove()
    }
    const script = document.createElement('script')
    const timeout = window.setTimeout(() => { script.remove(); reject(new Error('timeout')) }, 10_000)
    const finish = (callback: () => void) => { window.clearTimeout(timeout); callback() }
    script.dataset.naverMapSdk = parameter
    script.async = true
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?${parameter}=${encodeURIComponent(clientId)}&submodules=geocoder`
    script.onload = () => finish(() => window.naver?.maps ? resolve() : reject(new Error('rejected')))
    script.onerror = () => finish(() => reject(new Error('load failed')))
    document.head.append(script)
  })
}

async function loadNaverMapScript(clientId: string) {
  if (window.naver?.maps) return
  try { await appendNaverMapScript(clientId, 'ncpKeyId') } catch { await appendNaverMapScript(clientId, 'ncpClientId') }
}

function flameMarkerMarkup(label: string) {
  const safe = label.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
  return `<div class="map-marker map-marker--flame" aria-label="${safe}: 갤러리 긍정 언급 높음"><span class="map-flame" aria-hidden="true">🔥</span><span class="map-marker__label">${safe}</span></div>`
}

function standardMarkerMarkup(label: string) {
  const safe = label.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
  return `<div class="map-marker" aria-label="${safe}"><span class="map-dot" aria-hidden="true"></span><span class="map-marker__label">${safe}</span></div>`
}

export function NaverMap({ restaurants }: { restaurants: Restaurant[] }) {
  const mapElement = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<NaverMapsMap | null>(null)
  const markers = useRef<NaverMapsMarker[]>([])
  const initialRestaurants = useMemo(() => restaurants.map(withCoordinates).filter((item): item is MappedRestaurant => item !== null), [restaurants])
  const [mappedRestaurants, setMappedRestaurants] = useState(initialRestaurants)
  const [selectedId, setSelectedId] = useState<string | null>(initialRestaurants[0]?.id ?? null)
  const [mapError, setMapError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<'all' | RamenCategory>('all')
  const visibleRestaurants = useMemo(() => category === 'all'
    ? mappedRestaurants
    : mappedRestaurants.filter((restaurant) => restaurant.ramenCategories.includes(category)), [category, mappedRestaurants])
  const selected = mappedRestaurants.find((restaurant) => restaurant.id === selectedId) ?? visibleRestaurants[0]

  useEffect(() => {
    let cancelled = false
    async function initialiseMap() {
      try {
        const clientId = await getMapClientId()
        await loadNaverMapScript(clientId)
        if (cancelled || !mapElement.current || !window.naver?.maps) return
        mapInstance.current = new window.naver.maps.Map(mapElement.current, { center: new window.naver.maps.LatLng(defaultCenter.lat, defaultCenter.lng), zoom: 11 })
        const places = await resolveNaverPlaces(restaurants.map((restaurant) => restaurant.name))
        const resolved = await Promise.all(restaurants.map(async (restaurant): Promise<MappedRestaurant | null> => {
          const place = places[restaurant.name]
          let coordinates = place?.coordinates ?? restaurant.coordinates
          if (!coordinates) {
            try { coordinates = await geocodeAddress(restaurant.address) }
            catch { try { coordinates = await geocodeWithMapSdk(restaurant.address) } catch { return null } }
          }
          return { ...restaurant, address: place?.address ?? restaurant.address, coordinates, locationPrecision: place ? 'exact' : restaurant.locationPrecision, mapLinks: { ...restaurant.mapLinks, naver: place?.naverPlaceUrl ?? restaurant.mapLinks.naver }, ratingTier: getRatingTier(restaurant.name) }
        }))
        if (!cancelled) setMappedRestaurants(resolved.filter((item): item is MappedRestaurant => item !== null))
      } catch {
        if (!cancelled) setMapError('지도를 불러오지 못했습니다. 매장 상세 정보와 외부 지도 링크는 계속 이용할 수 있습니다.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void initialiseMap()
    return () => { cancelled = true }
  }, [restaurants])

  useEffect(() => {
    if (!mapInstance.current || !window.naver?.maps) return
    markers.current.forEach((marker) => marker.setMap(null))
    markers.current = []
    const bounds = new window.naver.maps.LatLngBounds()
    visibleRestaurants.forEach((restaurant) => {
      const position = new window.naver!.maps.LatLng(restaurant.coordinates.lat, restaurant.coordinates.lng)
      const markerOptions = {
        map: mapInstance.current!,
        position,
        title: restaurant.ratingTier === 'high' ? `${restaurant.name}: 갤러리 긍정 언급 높음` : restaurant.name,
        icon: {
          content: restaurant.ratingTier === 'high' ? flameMarkerMarkup(restaurant.name) : standardMarkerMarkup(restaurant.name),
          anchor: new window.naver!.maps.Point(8, 16),
        },
      }
      const marker = new window.naver!.maps.Marker(markerOptions)
      window.naver!.maps.Event.addListener(marker, 'click', () => setSelectedId(restaurant.id))
      markers.current.push(marker)
      bounds.extend(position)
    })
    if (markers.current.length) mapInstance.current.fitBounds(bounds, 48)
  }, [visibleRestaurants])

  useEffect(() => {
    if (!visibleRestaurants.some((restaurant) => restaurant.id === selectedId)) setSelectedId(visibleRestaurants[0]?.id ?? null)
  }, [selectedId, visibleRestaurants])

  return (
    <section className="map-section" aria-labelledby="map-heading">
      <div className="map-section__header"><div><p className="eyebrow">전체 매장</p><h2 id="map-heading">부산 라멘 찾기</h2></div><p className="map-section__stats" aria-live="polite"><strong>{visibleRestaurants.length}</strong><span>개 결과</span></p></div>
      <div className="category-filter" aria-label="라멘 계열 필터">{(Object.keys(categoryLabels) as Array<'all' | RamenCategory>).map((item) => <button type="button" key={item} aria-pressed={category === item} onClick={() => setCategory(item)}>{categoryLabels[item]}</button>)}</div>
      {mapError && <p className="map-error" role="alert">{mapError}</p>}
      <div className="map-layout">
        <div className="map-canvas" ref={mapElement} aria-label="부산 라멘 매장 지도">{loading && <span className="map-loading">지도 불러오는 중</span>}</div>
        <div className="restaurant-browser">
          {visibleRestaurants.length === 0 && <p className="empty-state">조건에 맞는 매장이 없습니다.</p>}
          {selected && (
            <article className="restaurant-detail" aria-live="polite">
              <header>
                <p className="eyebrow">매장 상세</p>
                <h3>{selected.name}</h3>
                <span>{selected.area}{selected.branch ? ` · ${selected.branch}` : ''}</span>
              </header>
              <dl>
                <div><dt>주소</dt><dd>{selected.address}</dd></div>
                <div><dt>운영 시간</dt><dd>{selected.hours ?? '방문 전 확인 필요'}</dd></div>
                <div><dt>휴무</dt><dd>{selected.closedDays ?? '방문 전 확인 필요'}</dd></div>
              </dl>
              <section className="signature-menu" aria-labelledby={`signature-menu-${selected.id}`}>
                <h4 id={`signature-menu-${selected.id}`}>대표 메뉴</h4>
                {selected.signatureMenus.length
                  ? <ul>{selected.signatureMenus.map((menu) => <li key={menu.name}><span>{menu.name}</span><strong>{menu.price.toLocaleString('ko-KR')}원</strong></li>)}</ul>
                  : <p className="empty-copy">메뉴 정보 확인 중</p>}
              </section>
              <section className="review-summary" aria-labelledby={`review-summary-${selected.id}`}>
                <div className="review-summary__heading">
                  <h4 id={`review-summary-${selected.id}`}>최근 한 달 메뉴 후기</h4>
                  <span>{selected.community.reviewItems.length ? `${selected.community.reviewItems.length}개 메뉴` : '요약 준비 중'}</span>
                </div>
                {selected.community.reviewItems.length ? (
                  <ul className="review-summary__list">
                    {selected.community.reviewItems.map((item) => (
                      <li className="review-summary__item" key={item.menu}>
                        <h5>{item.menu}</h5>
                        <p>{item.summary}</p>
                        <details>
                          <summary>근거 후기 {item.evidencePostIds.length}건</summary>
                          <div className="review-evidence">
                            {item.evidencePostIds.map((postId) => (
                              <a key={postId} href={`https://gall.dcinside.com/mgallery/board/view/?id=busanramen&no=${postId}`} target="_blank" rel="noopener noreferrer">#{postId}</a>
                            ))}
                          </div>
                        </details>
                      </li>
                    ))}
                  </ul>
                ) : <p className="empty-copy">최근 한 달 후기에서 구체적인 메뉴 평가를 확인하지 못했습니다.</p>}
                <p className="review-summary__notice">커뮤니티 후기 요약이며 방문 시점과 개인 취향에 따라 다를 수 있습니다.</p>
              </section>
              <p className="verified-date">최근 확인: {selected.lastVerified}</p>
              <div className="external-links">{selected.mapLinks.naver && <a href={selected.mapLinks.naver} target="_blank" rel="noopener noreferrer">네이버 플레이스</a>}</div>
            </article>
          )}
        </div>
      </div>
    </section>
  )
}
