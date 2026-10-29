import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests against a running stack (frontend + API + MySQL).
 * Start the stack first (see docs/TESTING.md), then:
 *   E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... npm run e2e
 * Each test signs in once; keep the suite under the login rate limit (10/min per IP).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
