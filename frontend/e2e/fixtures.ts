import { expect, test as base } from '@playwright/test'

/**
 * Each test signs in on its own. Sharing a saved session between tests does not
 * work by design: refresh tokens rotate, and replaying an already-rotated token is
 * treated as theft (the whole session family is revoked).
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    const email = process.env.E2E_ADMIN_EMAIL
    const password = process.env.E2E_ADMIN_PASSWORD
    if (!email || !password) throw new Error('Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD')
    await page.goto('/login')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible()
    await use(page)
  },
})

export { expect }
