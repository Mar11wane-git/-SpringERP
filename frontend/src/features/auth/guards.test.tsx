import { screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/render'

import { RequirePermission } from './guards'

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('RequirePermission', () => {
  const fetchMock = vi.fn<typeof fetch>()
  beforeEach(() => vi.stubGlobal('fetch', fetchMock))
  afterEach(() => {
    fetchMock.mockReset()
    vi.unstubAllGlobals()
  })

  function restoreSessionAs(permissions: string[]) {
    fetchMock.mockResolvedValueOnce(
      json(200, {
        accessToken: 't',
        expiresAt: '2030-01-01T00:00:00Z',
        user: { id: 1, email: 'e@x.io', fullName: 'Eve', role: 'EMPLOYEE', mustChangePassword: false, permissions, employeeId: null },
      }),
    )
  }

  it('hides content when the permission is missing', async () => {
    restoreSessionAs(['DASHBOARD_READ'])
    renderWithProviders(
      <RequirePermission permission="USER_READ">
        <p>Secret admin page</p>
      </RequirePermission>,
    )
    expect(await screen.findByText("You don't have access to this page")).toBeInTheDocument()
    expect(screen.queryByText('Secret admin page')).not.toBeInTheDocument()
  })

  it('renders content when the permission is granted', async () => {
    restoreSessionAs(['USER_READ'])
    renderWithProviders(
      <RequirePermission permission="USER_READ">
        <p>Secret admin page</p>
      </RequirePermission>,
    )
    expect(await screen.findByText('Secret admin page')).toBeInTheDocument()
  })
})
