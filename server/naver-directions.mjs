import { config, requireNaverServerCredentials } from './config.mjs'

const directionsEndpoint = 'https://maps.apigw.ntruss.com/map-direction/v1/driving'
const geocodeEndpoint = 'https://maps.apigw.ntruss.com/map-geocode/v2/geocode'
const coordinatePattern = /^-?\d{1,3}(?:\.\d+)?,-?\d{1,3}(?:\.\d+)?$/

function validateCoordinate(value, label) {
  if (typeof value !== 'string' || !coordinatePattern.test(value)) {
    throw new Error(`${label} must be formatted as longitude,latitude`)
  }
  const [lng, lat] = value.split(',').map(Number)
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
    throw new Error(`${label} is outside valid longitude and latitude bounds`)
  }
}

export async function getDrivingDirections({ start, goal, waypoints = [] }) {
  requireNaverServerCredentials()
  validateCoordinate(start, 'start')
  validateCoordinate(goal, 'goal')

  if (!Array.isArray(waypoints) || waypoints.length > 5) {
    throw new Error('waypoints must contain between zero and five locations')
  }

  waypoints.forEach((waypoint, index) => validateCoordinate(waypoint, `waypoints[${index}]`))

  const parameters = new URLSearchParams({ start, goal, option: 'trafast' })

  if (waypoints.length > 0) {
    parameters.set('waypoints', waypoints.join('|'))
  }

  const response = await fetch(`${directionsEndpoint}?${parameters}`, {
    headers: {
      'X-NCP-APIGW-API-KEY-ID': config.naverMapClientId,
      'X-NCP-APIGW-API-KEY': config.naverMapClientSecret,
    },
    signal: AbortSignal.timeout(8_000),
  })

  if (!response.ok) {
    throw new Error(`Naver Directions 5 request failed with ${response.status}`)
  }

  return response.json()
}

export async function geocodeAddress(address) {
  requireNaverServerCredentials()

  if (typeof address !== 'string' || address.trim().length === 0) {
    throw new Error('address is required')
  }

  const response = await fetch(`${geocodeEndpoint}?${new URLSearchParams({ query: address })}`, {
    headers: {
      'X-NCP-APIGW-API-KEY-ID': config.naverMapClientId,
      'X-NCP-APIGW-API-KEY': config.naverMapClientSecret,
    },
    signal: AbortSignal.timeout(8_000),
  })

  if (!response.ok) {
    throw new Error(`Naver geocoding request failed with ${response.status}`)
  }

  const payload = await response.json()
  const location = payload.addresses?.[0]

  if (!location) {
    throw new Error('Naver geocoding returned no matching address')
  }

  return { lat: Number(location.y), lng: Number(location.x), roadAddress: location.roadAddress }
}
