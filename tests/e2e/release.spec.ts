import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route('**/api/config', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ naverMapClientId: 'e2e-placeholder' }) }))
  await page.route('https://oapi.map.naver.com/**', (route) => route.abort())
  await page.goto('/')
})

test('keeps all restaurant content usable when the map SDK fails', async ({ page }) => {
  await expect(page.getByRole('alert')).toContainText('매장 상세 정보와 외부 지도 링크')
  await expect(page.getByText('26', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('heading', { name: '가솔린앤로지스' })).toBeVisible()
  await expect(page.getByRole('link', { name: '네이버 플레이스' })).toBeVisible()
})

test('has no page-level horizontal overflow', async ({ page }) => {
  const dimensions = await page.evaluate(() => ({ clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }))
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)
})

test('renders a usable 404 page for an unknown address', async ({ page }) => {
  const response = await page.goto('/missing-page')
  expect(response?.status()).toBe(200)
  await expect(page.getByRole('heading', { name: '페이지를 찾을 수 없습니다.' })).toBeVisible()
})
