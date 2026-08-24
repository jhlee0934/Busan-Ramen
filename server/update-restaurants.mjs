import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import OpenAI from 'openai'
import { config } from './config.mjs'
import { collectGalleryReviews } from './collect-gallery-reviews.mjs'

const root = path.resolve(import.meta.dirname, '..')
const dataDirectory = path.join(root, 'data')
const updateDirectory = path.join(dataDirectory, 'updates')
const stateFile = path.join(dataDirectory, 'update-state.json')
const restaurantsFile = path.join(dataDirectory, 'restaurants.json')

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return fallback
    throw error
  }
}

function buildMenuPrompt(batch, reviews) {
  const names = batch.map((restaurant) => restaurant.name)
  const relevantReviews = reviews.filter((review) => review.restaurantNames.some((name) => names.includes(name)))
  return `부산 라멘 마이너 갤러리의 최근 한 달 후기 본문을 매장별, 메뉴별로 종합하라. 본문에서 "약칭(정식명)" 형태는 수집기가 확장한 메뉴 약칭이다. JSON만 반환하라. 형식: {"restaurants":[{"id":"restaurant id","name":"restaurant name","menus":[{"menu":"정확한 메뉴명","summary":"메뉴의 육수/소스, 면, 토핑, 염도, 양, 맛 평가를 종합한 중립적인 한국어 1~3문장","evidencePostIds":[123]}]}]}. 규칙: (1) 한 글에 여러 매장이나 메뉴가 있으면 각각 분리한다. (2) 같은 메뉴의 모든 후기 내용을 합친다. (3) 언급 횟수나 긍정/부정 개수를 쓰지 않는다. (4) 본문에 없는 사실을 추론하지 않는다. (5) 근거가 구체적인 메뉴를 우선해 매장당 최대 3개만 반환한다. (6) 메뉴 평가가 없는 매장은 menus를 빈 배열로 반환한다. 대상 매장: ${JSON.stringify(batch.map(({ id, name }) => ({ id, name })))} 후기: ${JSON.stringify(relevantReviews)}`
}

function validateBatchResult(payload, batch, reviewPostIds) {
  if (!Array.isArray(payload.restaurants)) throw new Error('OpenAI response has no restaurants array')
  const allowedIds = new Set(batch.map((restaurant) => restaurant.id))
  return payload.restaurants.filter((item) => allowedIds.has(item.id)).map((item) => ({
    id: item.id,
    menus: Array.isArray(item.menus) ? item.menus.slice(0, 3).filter((menu) =>
      typeof menu.menu === 'string' && menu.menu.trim()
      && typeof menu.summary === 'string' && menu.summary.trim()
      && Array.isArray(menu.evidencePostIds),
    ).map((menu) => ({
      menu: menu.menu.trim(),
      summary: menu.summary.trim(),
      evidencePostIds: [...new Set(menu.evidencePostIds.filter((id) => reviewPostIds.has(id)))],
    })).filter((menu) => menu.evidencePostIds.length > 0) : [],
  }))
}

async function summarizeMenus(client, restaurants, corpus) {
  const output = []
  const reviewPostIds = new Set(corpus.reviews.map((review) => review.postId))
  for (let index = 0; index < restaurants.length; index += 4) {
    const batch = restaurants.slice(index, index + 4)
    const response = await client.responses.create({
      model: config.openAiModel,
      store: false,
      input: buildMenuPrompt(batch, corpus.reviews),
    })
    let payload
    try {
      payload = JSON.parse(response.output_text)
    } catch {
      throw new Error(`OpenAI returned invalid JSON for restaurant batch ${index / 4 + 1}`)
    }
    output.push(...validateBatchResult(payload, batch, reviewPostIds))
  }
  return output
}

export function applyMenuSummaries(restaurants, summaries, createdAt) {
  const proposedRestaurants = structuredClone(restaurants)
  const summariesById = new Map(summaries.map((summary) => [summary.id, summary.menus]))
  for (const restaurant of proposedRestaurants) {
    if (!summariesById.has(restaurant.id)) continue
    const reviewItems = summariesById.get(restaurant.id)
    const generatedEvidencePostIds = [...new Set(reviewItems.flatMap((item) => item.evidencePostIds))]
    const evidencePostIds = generatedEvidencePostIds.length >= 2
      ? generatedEvidencePostIds
      : [...new Set([...generatedEvidencePostIds, ...(restaurant.community?.evidencePostIds ?? [])])]
    restaurant.community = {
      ...restaurant.community,
      reviewItems,
      summary: reviewItems.map((item) => `${item.menu}: ${item.summary}`).join(' ') || '최근 한 달 후기에서 구체적인 메뉴 평가를 확인하지 못했다.',
      evidencePostIds,
      generatedBy: 'openai',
      updatedAt: createdAt.slice(0, 10),
    }
    const text = JSON.stringify({ styles: restaurant.ramenStyles, menus: restaurant.signatureMenus, reviews: reviewItems, features: restaurant.features })
    const rules = [['jiro', /지로|스트롱부타|야채많이|세아부라/i], ['chintan', /청탕|쇼유|시오|다시소바|중화소바/i], ['paitan', /백탕|파이탄|돈코츠|돼지.?육수|돈사골/i], ['tsukemen', /츠케멘/i], ['abura', /아부라|마제|비빔/i]]
    const categories = rules.filter(([, pattern]) => pattern.test(text)).map(([category]) => category)
    restaurant.ramenCategories = categories.length > 0 ? categories : ['other']
  }
  return proposedRestaurants
}

export async function createRestaurantUpdateDraft() {
  if (!config.openAiApiKey) throw new Error('OPENAI_API_KEY is required for data updates')
  const restaurants = await readJson(restaurantsFile, [])
  const corpus = await collectGalleryReviews()
  const client = new OpenAI({ apiKey: config.openAiApiKey })
  const reviewSummaries = await summarizeMenus(client, restaurants, corpus)
  const createdAt = new Date().toISOString()
  const proposedRestaurants = applyMenuSummaries(restaurants, reviewSummaries, createdAt)
  await mkdir(updateDirectory, { recursive: true })
  const draftFile = path.join(updateDirectory, `pending-${createdAt.replaceAll(':', '-')}.json`)
  const draft = { range: corpus.range, scannedReviewPostCount: corpus.scannedReviewPostCount, reviewSummaries, proposedRestaurants }
  await writeFile(draftFile, `${JSON.stringify({ createdAt, model: config.openAiModel, draft }, null, 2)}\n`, 'utf8')
  await writeFile(stateFile, `${JSON.stringify({ lastSuccessfulDraftAt: createdAt, draftFile: path.relative(root, draftFile) }, null, 2)}\n`, 'utf8')
  return { createdAt, draftFile: path.relative(root, draftFile), updateCount: reviewSummaries.length }
}

export async function shouldRunUpdate() {
  const state = await readJson(stateFile, {})
  if (!state.lastSuccessfulDraftAt) return true
  return Date.now() - Date.parse(state.lastSuccessfulDraftAt) >= 72 * 60 * 60 * 1000
}
