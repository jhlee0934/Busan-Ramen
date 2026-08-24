export type Coordinates = { lat: number; lng: number }

function withTimeout<T>(operation: Promise<T>, message: string, timeoutMs = 8000): Promise<T> {
  return Promise.race([
    operation,
    new Promise<T>((_resolve, reject) => window.setTimeout(() => reject(new Error(message)), timeoutMs)),
  ])
}

export async function getMapClientId(): Promise<string> {
  const staticClientId = import.meta.env.VITE_NAVER_MAP_CLIENT_ID
  if (staticClientId) return staticClientId

  const response = await fetch('/api/config')

  if (!response.ok) {
    throw new Error('Map configuration could not be loaded')
  }

  const payload: { naverMapClientId: string | null } = await response.json()

  if (!payload.naverMapClientId) {
    throw new Error('NAVER_MAP_CLIENT_ID is not configured')
  }

  return payload.naverMapClientId
}

export type NaverPlaceResult = {
  placeId: string
  name: string
  address: string
  coordinates: Coordinates
  naverPlaceUrl: string
}

export async function resolveNaverPlaces(names: string[]): Promise<Record<string, NaverPlaceResult | null>> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 30000)
  try {
    const response = await fetch('/api/places/resolve', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ names }),
      signal: controller.signal,
    })
    if (!response.ok) return {}
    const payload: { places: Record<string, NaverPlaceResult | null> } = await response.json()
    return payload.places
  } catch {
    return {}
  } finally {
    window.clearTimeout(timeout)
  }
}

export async function geocodeAddress(address: string): Promise<Coordinates> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 8000)
  let response: Response

  try {
    response = await fetch(`/api/geocode?${new URLSearchParams({ address })}`, { signal: controller.signal })
  } finally {
    window.clearTimeout(timeout)
  }

  if (!response.ok) {
    const payload: { error?: string } = await response.json().catch(() => ({}))
    throw new Error(payload.error ?? 'The store address could not be mapped')
  }

  return response.json()
}

export function geocodeWithMapSdk(address: string): Promise<Coordinates> {
  const maps = window.naver?.maps

  if (!maps?.Service) {
    return Promise.reject(new Error('Naver Map geocoder is not available'))
  }

  return withTimeout(new Promise((resolve, reject) => {
    maps.Service.geocode({ query: address }, (status, response) => {
      const addressResult = response.v2?.addresses?.[0]

      if (status !== maps.Status.OK || !addressResult) {
        reject(new Error('Naver Map geocoder returned no matching address'))
        return
      }

      resolve({ lat: Number(addressResult.y), lng: Number(addressResult.x) })
    })
  }), 'Naver Map geocoder timed out')
}

type RouteLocation = { name: string; coordinates: Coordinates }

export function createNaverDirectionsUrl(
  start: RouteLocation,
  goal: RouteLocation,
  waypoints: RouteLocation[],
  mode: 'car' | 'walk' | 'transit',
) {
  const segment = ({ name, coordinates }: RouteLocation) =>
    `${coordinates.lng},${coordinates.lat},${encodeURIComponent(name)},PLACE_POI`
  const locations = [start, ...waypoints.slice(0, 5), goal].map(segment).join('/')
  return `https://map.naver.com/p/directions/${locations}/-/${mode}`
}
