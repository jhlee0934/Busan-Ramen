import { createServer } from 'node:http'
import { afterEach, describe, expect, it } from 'vitest'
import express from 'express'
import { createApp, createRateLimiter } from '../server/app.mjs'

const servers: ReturnType<typeof createServer>[] = []
afterEach(() => Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve())))))

async function start(app: ReturnType<typeof express>) {
  const server = createServer(app)
  servers.push(server)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Test server did not start')
  return `http://127.0.0.1:${address.port}`
}

describe('public API boundaries', () => {
  it('returns a JSON 404 for unknown API routes', async () => {
    const baseUrl = await start(createApp())
    const response = await fetch(`${baseUrl}/api/not-found`)
    expect(response.status).toBe(404)
    expect(response.headers.get('content-type')).toContain('application/json')
    await expect(response.json()).resolves.toMatchObject({ code: 'API_NOT_FOUND' })
  })

  it('returns HTTP 404 with the app shell for unknown pages', async () => {
    const baseUrl = await start(createApp())
    const response = await fetch(`${baseUrl}/missing-page`)
    expect(response.status).toBe(404)
    expect(response.headers.get('content-type')).toContain('text/html')
  })

  it('does not expose upstream error details', async () => {
    const baseUrl = await start(createApp({ geocodeAddress: async () => { throw new Error('private upstream detail') } }))
    const response = await fetch(`${baseUrl}/api/geocode?address=test`)
    expect(response.status).toBe(400)
    expect(await response.text()).not.toContain('private upstream detail')
  })

  it('limits repeated requests from one client', async () => {
    const app = express()
    app.use(createRateLimiter({ windowMs: 60_000, max: 2 }))
    app.get('/', (_request, response) => response.sendStatus(204))
    const baseUrl = await start(app)
    expect((await fetch(baseUrl)).status).toBe(204)
    expect((await fetch(baseUrl)).status).toBe(204)
    const limited = await fetch(baseUrl)
    expect(limited.status).toBe(429)
    expect(limited.headers.get('retry-after')).toBeTruthy()
  })
})
