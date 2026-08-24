import { describe, expect, it } from 'vitest'
import { expandMenuAliases, matchingRestaurants } from '../server/collect-gallery-reviews.mjs'

describe('gallery aliases', () => {
  it('recognizes abbreviated and multiple restaurant names in one review', () => {
    expect(matchingRestaurants('부갱 먹고 다음으로 유메도 방문함')).toEqual(expect.arrayContaining(['부타갱스터', '라멘유메']))
  })

  it('expands abbreviated menu names before summarization', () => {
    expect(expandMenuAliases('오늘 진멸 국물과 면이 좋았다')).toContain('진멸(진한멸치시오라멘)')
  })

  it('does not confuse generic menu terms or overlapping shop names', () => {
    expect(matchingRestaurants('가솔린앤로지스 후기')).toEqual(['가솔린앤로지스'])
    expect(matchingRestaurants('아부라소바 후기')).toEqual([])
    expect(matchingRestaurants('사이멘 후기')).toEqual([])
  })
})
