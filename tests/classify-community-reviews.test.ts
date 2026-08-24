import { describe, expect, it } from 'vitest'
import { classifySentiment } from '../server/classify-community-reviews.mjs'

describe('community review sentiment classification', () => {
  it('classifies clear positive and negative language', () => {
    expect(classifySentiment({ title: '', body: '국물이 진하고 맛있어서 추천' })).toBe('positive')
    expect(classifySentiment({ title: '', body: '내 취향에는 별로라 비추' })).toBe('negative')
  })

  it('keeps conflicting and unsupported opinions conservative', () => {
    expect(classifySentiment({ title: '', body: '맛있지만 끝에는 조금 느끼했다' })).toBe('mixed')
    expect(classifySentiment({ title: '오늘 방문', body: '시오라멘을 주문했다' })).toBe('neutral')
  })
})
