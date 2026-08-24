import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { applyMenuSummaries } from '../server/update-restaurants.mjs'

describe('update draft isolation', () => {
  it('creates a proposed copy without mutating published restaurants', () => {
    const published = [{ id: 'one', ramenStyles: [], ramenCategories: ['other'], signatureMenus: [], features: {}, community: { summary: 'old' } }]
    const before = structuredClone(published)
    const proposed = applyMenuSummaries(published, [{ id: 'one', menus: [{ menu: '쇼유', summary: '새 요약', evidencePostIds: [1] }] }], '2026-08-25T00:00:00.000Z')
    expect(published).toEqual(before)
    expect(proposed).not.toBe(published)
    expect(proposed[0].community.summary).toContain('새 요약')
  })

  it('contains no direct write to the published restaurant file', async () => {
    const source = await readFile(new URL('../server/update-restaurants.mjs', import.meta.url), 'utf8')
    expect(source).not.toMatch(/writeFile\(restaurantsFile/)
  })
})
