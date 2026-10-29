import type { Page } from '@playwright/test'

import { expect, test } from './fixtures'

const unique = () => Date.now().toString(36).toUpperCase()

async function createProduct(page: Page, sku: string, name: string, stock: number) {
  await page.goto('/inventory/products')
  await page.getByRole('button', { name: 'New product' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('SKU').fill(sku)
  await dialog.getByLabel('Name').fill(name)
  await dialog.getByLabel('Selling price').fill('40.00')
  await dialog.getByLabel('Cost price').fill('22.50')
  await dialog.getByLabel('Opening stock').fill(String(stock))
  await dialog.getByRole('button', { name: 'Create product' }).click()
  await expect(page.getByText(`${sku} created`)).toBeVisible()
}

async function createCustomer(page: Page, name: string) {
  await page.goto('/customers')
  await page.getByRole('button', { name: 'New customer' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Name').fill(name)
  await dialog.getByLabel('City').fill('E2E City')
  await dialog.getByRole('button', { name: 'Save customer' }).click()
  await expect(page.getByText(`${name} saved`)).toBeVisible()
}

test('quote → confirmed order → invoice → payment', async ({ page }) => {
  const id = unique()
  const sku = `E2E-${id}`
  const customer = `E2E Customer ${id}`
  await createProduct(page, sku, `E2E product ${id}`, 10)
  await createCustomer(page, customer)

  // Quote with 3 units at 10% discount: 120.00 gross, 12.00 discount, 108.00 net, 21.60 tax, 129.60 total.
  await page.goto('/sales/orders/new')
  const customerSelect = page.getByLabel('Customer')
  const customerValue = await customerSelect.locator('option', { hasText: customer }).getAttribute('value')
  await customerSelect.selectOption(customerValue!)
  await page.getByRole('combobox', { name: 'Product for line 1' }).fill(sku)
  await page.getByRole('option', { name: new RegExp(sku) }).click()
  await page.getByLabel('Quantity line 1').fill('3')
  await page.getByLabel('Discount line 1').fill('10')
  await expect(page.getByText('€129.60')).toBeVisible() // client-side preview
  await page.getByRole('button', { name: 'Save draft' }).click()

  const title = page.getByRole('heading', { level: 1 })
  await expect(title).toContainText('Draft / quote')
  await expect(page.getByText('€129.60').first()).toBeVisible() // server-computed total matches

  await page.getByRole('button', { name: 'Confirm order' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm order' }).click()
  await expect(title).toContainText('Confirmed')

  await page.getByRole('button', { name: 'Create invoice' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Issue invoice' }).click()
  await expect(page).toHaveURL(/\/invoices\/\d+$/)
  await expect(page.getByRole('heading', { name: /INV-\d{4}-\d{5}/ })).toBeVisible()

  // Overpayment is refused client-side, then the exact balance settles the invoice.
  await page.getByRole('button', { name: 'Record payment' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel(/Amount/).fill('500.00')
  await dialog.getByRole('button', { name: 'Record payment' }).click()
  await expect(dialog.getByText(/Cannot exceed the balance due/)).toBeVisible()
  await dialog.getByLabel(/Amount/).fill('129.60')
  await dialog.getByLabel('Reference').fill(`E2E-${id}`)
  await dialog.getByRole('button', { name: 'Record payment' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Paid')
  await expect(page.getByText('Balance due').locator('..')).toContainText('€0.00')

  // Stock went from 10 to 7.
  await page.goto('/inventory/products')
  await page.getByRole('searchbox').fill(sku)
  await expect(page.getByRole('row', { name: new RegExp(sku) })).toContainText('7 pcs')
})

test('navigation only lists what the role may access', async ({ page }) => {
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Main' })
  // The administrator sees administration entries.
  await expect(nav.getByRole('link', { name: 'Users' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Audit log' })).toBeVisible()
  // Unknown routes render the not-found page inside the shell.
  await page.goto('/does-not-exist')
  await expect(page.getByText('Page not found')).toBeVisible()
})
