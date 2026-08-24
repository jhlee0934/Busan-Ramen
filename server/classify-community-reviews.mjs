import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const dataDirectory = path.join(root, 'data')
const updatesDirectory = path.join(dataDirectory, 'updates')

const positivePattern = /맛있|존맛|개맛|최고|추천|ㅊㅊ|좋았|좋음|훌륭|만족|매력|취향(?:이었|저격)|잘\s*먹|재방문|또\s*갈|극호|미쳤/u
const negativePattern = /맛없|노맛|별로|최악|실망|비추|불호|아쉽|아쉬|물리|느끼|비싸|안\s*갈|못\s*먹/u

export function classifySentiment(review) {
  const text = `${review.title ?? ''} ${review.body ?? ''}`
  const positive = positivePattern.test(text)
  const negative = negativePattern.test(text)
  if (positive && negative) return 'mixed'
  if (positive) return 'positive'
  if (negative) return 'negative'
  return 'neutral'
}

function tierFor({ positivePostIds, negativePostIds, mixedPostIds, neutralPostIds }) {
  if (negativePostIds.length > 0 || mixedPostIds.length > 0) return 'low'
  if (positivePostIds.length >= 2) return 'high'
  if (positivePostIds.length >= 1 || neutralPostIds.length >= 2) return 'medium'
  return neutralPostIds.length === 0 ? 'unrated' : 'low'
}

export async function createCommunityRatingDraft() {
  const corpus = JSON.parse(await readFile(path.join(dataDirectory, 'community-reviews.json'), 'utf8'))
  const candidates = JSON.parse(await readFile(path.join(dataDirectory, 'community-candidates.json'), 'utf8'))
  const currentRatings = JSON.parse(await readFile(path.join(dataDirectory, 'community-ratings.json'), 'utf8'))
  const currentByName = new Map(currentRatings.ratings.map((rating) => [rating.name, rating]))

  const ratings = candidates.candidates.map((candidate) => {
    const buckets = { positivePostIds: [], negativePostIds: [], mixedPostIds: [], neutralPostIds: [] }
    for (const review of corpus.reviews.filter((item) => item.restaurantNames.includes(candidate.name))) {
      buckets[`${classifySentiment(review)}PostIds`].push(review.postId)
    }
    const tier = tierFor(buckets)
    return {
      name: candidate.name,
      score: { high: 5, medium: 3, low: 2, unrated: 0 }[tier],
      tier,
      ...buckets,
      provisional: true,
      classificationMethod: 'keyword-rules-v1',
      mapInclusion: true,
      geocodingStatus: currentByName.get(candidate.name)?.geocodingStatus ?? 'verified',
    }
  })

  const createdAt = new Date().toISOString()
  const payload = {
    createdAt,
    calculationVersion: 'rolling-31-days-keyword-v1',
    range: corpus.range,
    collectionWindowDays: corpus.collectionWindowDays,
    sourceReviewCount: corpus.reviews.length,
    provisional: true,
    caveat: '키워드 기반 잠정 분류이며 문맥, 반어, 여러 매장 비교를 사람이 검수해야 한다.',
    rules: {
      high: '긍정 2건 이상이며 부정·혼합 없음',
      medium: '긍정 1건 이상 또는 중립 2건 이상이며 부정·혼합 없음',
      low: '부정·혼합 1건 이상, 또는 긍정 근거 부족',
      unrated: '수집 기간 내 연결된 후기 없음',
    },
    ratings,
  }
  await mkdir(updatesDirectory, { recursive: true })
  const fileName = `pending-ratings-${createdAt.replaceAll(':', '-')}.json`
  await writeFile(path.join(updatesDirectory, fileName), `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  return { file: path.join('data', 'updates', fileName), payload }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const { file, payload } = await createCommunityRatingDraft()
  const counts = Object.groupBy(payload.ratings, (rating) => rating.tier)
  console.log(JSON.stringify({ file, sourceReviewCount: payload.sourceReviewCount, tierCounts: Object.fromEntries(Object.entries(counts).map(([tier, items]) => [tier, items.length])) }))
}
