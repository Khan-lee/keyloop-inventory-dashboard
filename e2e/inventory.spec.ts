import { expect, test, type Page } from '@playwright/test'

// Every test gets a fresh browser context, so localStorage (the mock DB) starts from the seed.

const rows = (page: Page) => page.locator('tbody tr')

async function openDashboard(page: Page, query = '') {
  await page.goto(`/${query}`)
  await expect(page.getByRole('heading', { name: 'Inventory Dashboard' })).toBeVisible()
}

/** Waits until every visible row's cell text satisfies `ok` (the list re-renders after each request). */
async function expectEveryRow(page: Page, cell: string, ok: (text: string) => boolean) {
  await expect
    .poll(async () => {
      const texts = await rows(page).locator(cell).allTextContents()
      return texts.length > 0 && texts.every(ok)
    })
    .toBe(true)
}

test('filters the list by make, model and age', async ({ page }) => {
  await openDashboard(page)
  const make = page.getByRole('combobox', { name: 'Make', exact: true })
  const model = page.getByRole('combobox', { name: 'Model', exact: true })

  await make.selectOption('Ford')
  await expect(model).toBeEnabled()
  await expectEveryRow(page, '.vehicle', (t) => t.includes('Ford'))

  const firstModel = (await model.locator('option').nth(1).textContent())!
  await model.selectOption(firstModel)
  await expectEveryRow(page, '.vehicle', (t) => t.includes(`Ford ${firstModel}`))

  await page.getByRole('button', { name: 'Clear filters' }).first().click()
  await page.getByRole('combobox', { name: 'Age', exact: true }).selectOption('0-30')
  await expectEveryRow(page, 'td:nth-child(4)', (t) => Number.parseInt(t) <= 30 && !t.includes('Aging'))
})

test('shows aging stock prominently and only vehicles over 90 days in the aging view', async ({ page }) => {
  await openDashboard(page)
  const agingKpi = Number(await page.getByTestId('kpi-aging').locator('.value').textContent())
  expect(agingKpi).toBeGreaterThan(0)

  await page.getByRole('tab', { name: /Aging stock/ }).click()
  await expect(page.getByRole('tab', { name: /Aging stock/ })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByTestId('range')).toContainText(`of ${agingKpi}`)
  await expectEveryRow(page, 'td:nth-child(4)', (t) => t.includes('Aging') && Number.parseInt(t) > 90)
})

test('logs an action for an aging vehicle and keeps it after a reload', async ({ page }) => {
  await openDashboard(page)
  await page.getByRole('tab', { name: /Aging stock/ }).click()
  const row = rows(page).filter({ hasText: 'No action yet' }).first()
  const vin = (await row.locator('td.mono').textContent())!.trim()
  const noActionBefore = Number(await page.getByTestId('kpi-no-action').textContent())

  await row.getByRole('button', { name: /Log action/ }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('Status / proposed action').selectOption('SENT_TO_AUCTION')
  await dialog.getByLabel(/Note/).fill('Auction on Friday')
  await dialog.getByLabel('Your name').fill('Jordan Lee')
  await dialog.getByRole('button', { name: 'Save action' }).click()

  await expect(dialog.getByTestId('history-item').first()).toContainText('Sent to auction')
  await expect(page.getByTestId('kpi-no-action')).toHaveText(String(noActionBefore - 1))
  await dialog.getByRole('button', { name: 'Close' }).click()

  await page.reload()
  await page.getByRole('searchbox', { name: 'Search' }).fill(vin)
  const saved = rows(page).filter({ hasText: vin })
  await expect(saved).toHaveCount(1)
  await expect(saved).toContainText('Sent to auction')

  await saved.getByRole('button', { name: /Update/ }).click()
  await expect(page.getByRole('dialog').getByTestId('history-item').first()).toContainText('Auction on Friday')
  await expect(page.getByRole('dialog').getByLabel('Your name')).toHaveValue('Jordan Lee')
})

test('switching dealership shows that dealership’s stock', async ({ page }) => {
  await openDashboard(page)
  await expect(page.getByText('Northgate Motors · Manchester')).toBeVisible()
  await page.getByLabel('Dealership').selectOption('d2')
  await expect(page.getByText('Riverside Auto · Leeds')).toBeVisible()
  await expect(page.getByTestId('kpi-total')).toHaveText('60')
})

test('shows an error state with retry when the API is down', async ({ page }) => {
  await openDashboard(page, '?mock=error')
  await expect(page.getByRole('alert')).toContainText("We couldn't load the inventory")
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
})

test('shows an empty state when no vehicle matches', async ({ page }) => {
  await openDashboard(page)
  await page.getByRole('searchbox', { name: 'Search' }).fill('NO-SUCH-VIN')
  await expect(page.getByText('No vehicles match these filters')).toBeVisible()
})
