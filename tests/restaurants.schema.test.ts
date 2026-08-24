import { describe, expect, it } from 'vitest'
import { loadPublishedRestaurants, loadRestaurants } from '../src/features/restaurants/data'
import { RestaurantCollectionSchema } from '../src/features/restaurants/schema'

const validRestaurant = {
  id: 'test-ramen',
  name: 'Test Ramen',
  branch: null,
  area: 'Busan',
  address: '1 Test-ro, Busan',
  nearestStation: null,
  coordinates: { lat: 35.1796, lng: 129.0756 },
  ramenStyles: ['Shoyu'],
  ramenCategories: ['chintan'],
  signatureMenus: [
    { name: 'Shoyu Ramen', price: 10000, description: 'Test menu' },
  ],
  features: {
    broth: 'Clear chicken broth',
    noodles: 'Thin noodles',
    tare: 'Soy sauce tare',
    toppings: 'Chicken chashu',
  },
  enthusiastNote: 'A test-only verified fixture.',
  cautions: [],
  hours: '11:00-20:00',
  closedDays: 'Monday',
  breakTime: null,
  waitingInfo: null,
  lastVerified: '2026-08-22',
  mapLinks: {
    naver: 'https://map.naver.com/',
    kakao: 'https://map.kakao.com/',
  },
  community: {
    summary: '검토 게시물의 평가를 요약한 테스트 fixture.',
    generatedBy: 'rating-fallback',
    updatedAt: '2026-08-22',
    evidencePostIds: [100, 101],
  },
  sources: [
    {
      title: 'Community source',
      url: 'https://example.com/community',
      publishedOrCheckedAt: '2026-08-20',
      supports: 'Recommendation rationale',
    },
    {
      title: 'Official source',
      url: 'https://example.com/official',
      publishedOrCheckedAt: '2026-08-22',
      supports: 'Operating information',
    },
  ],
}

describe('restaurant data schema', () => {
  it('accepts a complete verified restaurant', () => {
    expect(RestaurantCollectionSchema.safeParse([validRestaurant]).success).toBe(true)
  })

  it('accepts an empty published dataset before research is complete', () => {
    expect(loadRestaurants([])).toEqual({ status: 'ready', restaurants: [] })
  })

  it('loads every published restaurant record', () => {
    const result = loadRestaurants()

    expect(result.status).toBe('ready')
    expect(result.status === 'ready' && result.restaurants).toHaveLength(26)
    if (result.status === 'ready') {
      expect(new Set(result.restaurants.map((restaurant) => restaurant.name)).size).toBe(26)
      expect(result.restaurants.filter((restaurant) => restaurant.locationPrecision === 'exact')).toHaveLength(26)
      expect(result.restaurants.filter((restaurant) => restaurant.locationPrecision === 'area')).toHaveLength(0)
    }
  })

  it('separates verified public records from candidates', () => {
    const result = loadPublishedRestaurants()
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      expect(result.restaurants).toHaveLength(1)
      expect(result.restaurants.every((restaurant) => restaurant.verificationStatus === 'verified')).toBe(true)
    }
  })

  it('rejects a restaurant with fewer than two sources', () => {
    const result = loadRestaurants([{ ...validRestaurant, sources: [validRestaurant.sources[0]] }])

    expect(result.status).toBe('error')
  })

  it('rejects invalid volatile data and unsafe source URLs', () => {
    const result = loadRestaurants([
      {
        ...validRestaurant,
        lastVerified: '22-08-2026',
        signatureMenus: [{ ...validRestaurant.signatureMenus[0], price: 0 }],
        sources: [{ ...validRestaurant.sources[0], url: 'http://example.com' }, validRestaurant.sources[1]],
      },
    ])

    expect(result.status).toBe('error')
  })

  it('rejects out-of-range coordinates and duplicate ramen styles', () => {
    const result = loadRestaurants([
      {
        ...validRestaurant,
        coordinates: { lat: 91, lng: 129.0756 },
        ramenStyles: ['Shoyu', 'shoyu'],
      },
    ])

    expect(result.status).toBe('error')
  })
})
