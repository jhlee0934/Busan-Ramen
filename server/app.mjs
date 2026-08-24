import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { config } from './config.mjs'
import { geocodeAddress, getDrivingDirections } from './naver-directions.mjs'
import { createRestaurantUpdateDraft } from './update-restaurants.mjs'
import { resolveNaverPlaces } from './naver-place-resolver.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export function createRateLimiter({ windowMs, max }) {
  const clients = new Map()
  return (request, response, next) => {
    const now = Date.now()
    const key = request.ip || request.socket.remoteAddress || 'unknown'
    const previous = clients.get(key)
    const current = !previous || now >= previous.resetAt ? { count: 1, resetAt: now + windowMs } : { ...previous, count: previous.count + 1 }
    clients.set(key, current)
    response.set('RateLimit-Limit', String(max))
    response.set('RateLimit-Remaining', String(Math.max(0, max - current.count)))
    response.set('RateLimit-Reset', String(Math.ceil(current.resetAt / 1000)))
    if (current.count > max) {
      response.set('Retry-After', String(Math.max(1, Math.ceil((current.resetAt - now) / 1000))))
      response.status(429).json({ code: 'RATE_LIMITED', error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' })
      return
    }
    if (clients.size > 10_000) for (const [clientKey, value] of clients) if (now >= value.resetAt) clients.delete(clientKey)
    next()
  }
}

const publicError = (response, status, code, message) => response.status(status).json({ code, error: message })

export function createApp(overrides = {}) {
  const dependencies = { geocodeAddress, getDrivingDirections, createRestaurantUpdateDraft, resolveNaverPlaces, ...overrides }
  const app = express()
  if (config.trustProxy) app.set('trust proxy', 1)
  app.disable('x-powered-by')
  app.use(express.json({ limit: '16kb' }))
  app.use('/api', createRateLimiter({ windowMs: config.rateLimitWindowMs, max: config.rateLimitMax }))
  const externalLimiter = createRateLimiter({ windowMs: config.rateLimitWindowMs, max: config.externalApiRateLimitMax })

  app.get('/api/config', (_request, response) => response.json({ naverMapClientId: config.naverMapClientId ?? null }))
  app.get('/api/directions/driving', externalLimiter, async (request, response) => {
    try {
      const waypoints = typeof request.query.waypoints === 'string' && request.query.waypoints.length > 0 ? request.query.waypoints.split('|') : []
      response.json(await dependencies.getDrivingDirections({ start: request.query.start, goal: request.query.goal, waypoints }))
    } catch (error) {
      console.error('Directions request failed:', error instanceof Error ? error.message : 'unknown error')
      publicError(response, 400, 'INVALID_DIRECTIONS_REQUEST', '경로 요청을 처리할 수 없습니다.')
    }
  })
  app.get('/api/geocode', externalLimiter, async (request, response) => {
    try {
      response.json(await dependencies.geocodeAddress(request.query.address))
    } catch (error) {
      console.error('Geocode request failed:', error instanceof Error ? error.message : 'unknown error')
      publicError(response, 400, 'INVALID_GEOCODE_REQUEST', '주소를 확인할 수 없습니다.')
    }
  })
  app.post('/api/places/resolve', externalLimiter, async (request, response) => {
    const names = request.body?.names
    const valid = Array.isArray(names) && names.length > 0 && names.length <= 30 && names.every((name) => typeof name === 'string' && name.trim().length > 0 && name.length <= 80)
    if (!valid) return publicError(response, 400, 'INVALID_PLACE_NAMES', '매장 이름은 1개 이상 30개 이하로 입력해 주세요.')
    try {
      response.json({ places: await dependencies.resolveNaverPlaces([...new Set(names.map((name) => name.trim()))]) })
    } catch (error) {
      console.error('Place resolution failed:', error instanceof Error ? error.message : 'unknown error')
      publicError(response, 502, 'PLACE_SERVICE_UNAVAILABLE', '장소 정보를 불러오지 못했습니다.')
    }
  })
  app.post('/api/admin/updates/run', async (request, response) => {
    if (!config.updateAdminToken || request.get('authorization') !== `Bearer ${config.updateAdminToken}`) return publicError(response, 401, 'UNAUTHORIZED', '인증이 필요합니다.')
    try {
      response.status(202).json(await dependencies.createRestaurantUpdateDraft())
    } catch (error) {
      console.error('Update draft failed:', error instanceof Error ? error.message : 'unknown error')
      publicError(response, 500, 'UPDATE_FAILED', '업데이트 초안을 생성하지 못했습니다.')
    }
  })
  app.use('/api', (_request, response) => publicError(response, 404, 'API_NOT_FOUND', 'API 경로를 찾을 수 없습니다.'))
  const distDirectory = path.join(root, 'dist')
  app.use(express.static(distDirectory))
  app.get('/{*splat}', (_request, response) => response.status(404).sendFile(path.join(distDirectory, 'index.html')))
  return app
}
