import { describe, expect, it } from 'vitest'
import { createNaverDirectionsUrl } from '../src/features/maps/map-api'

describe('Naver directions link', () => {
  it('includes named start, waypoints, destination, and transport mode', () => {
    const start = { name: '출발 라멘', coordinates: { lat: 35.1, lng: 129.1 } }
    const goal = { name: '도착 라멘', coordinates: { lat: 35.3, lng: 129.3 } }
    const waypoint = { name: '경유 라멘', coordinates: { lat: 35.2, lng: 129.2 } }
    const url = createNaverDirectionsUrl(start, goal, [waypoint], 'car')

    expect(url).toBe('https://map.naver.com/p/directions/129.1,35.1,%EC%B6%9C%EB%B0%9C%20%EB%9D%BC%EB%A9%98,PLACE_POI/129.2,35.2,%EA%B2%BD%EC%9C%A0%20%EB%9D%BC%EB%A9%98,PLACE_POI/129.3,35.3,%EB%8F%84%EC%B0%A9%20%EB%9D%BC%EB%A9%98,PLACE_POI/-/car')
  })

  it('limits Naver Maps waypoints to five', () => {
    const start = { name: 'start', coordinates: { lat: 35.1, lng: 129.1 } }
    const goal = { name: 'goal', coordinates: { lat: 35.9, lng: 129.9 } }
    const waypoints = Array.from({ length: 6 }, (_, index) => ({
      name: `via-${index + 1}`,
      coordinates: { lat: 35.2 + index * 0.01, lng: 129.2 + index * 0.01 },
    }))

    expect(createNaverDirectionsUrl(start, goal, waypoints, 'walk')).not.toContain('via-6')
  })
})
