import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/render'

import LoginPage from './login-page'

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('LoginPage', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    // Session restore on mount: no refresh cookie.
    fetchMock.mockResolvedValueOnce(json(401, {}))
  })
  afterEach(() => {
    fetchMock.mockReset()
    vi.unstubAllGlobals()
  })

  it('validates input before calling the API', async () => {
    renderWithProviders(<LoginPage />, { path: '/login' })
    await userEvent.click(await screen.findByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText('Email is required')).toBeInTheDocument()
    expect(screen.getByText('Password is required')).toBeInTheDocument()
    // Only the initial session-restore call was made.
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('shows the server message when credentials are rejected', async () => {
    fetchMock.mockResolvedValueOnce(json(401, { code: 'UNAUTHORIZED', detail: 'Invalid email or password.' }))
    renderWithProviders(<LoginPage />, { path: '/login' })

    await userEvent.type(await screen.findByLabelText('Email'), 'someone@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'wrong-password-1')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.')
    const [url, init] = fetchMock.mock.calls[1]!
    expect(url).toBe('/api/auth/login')
    expect(JSON.parse(String(init!.body))).toEqual({ email: 'someone@example.com', password: 'wrong-password-1' })
  })

  it('redirects to the dashboard after a successful sign-in', async () => {
    fetchMock.mockResolvedValueOnce(
      json(200, {
        accessToken: 't',
        expiresAt: '2030-01-01T00:00:00Z',
        user: { id: 1, email: 'ada@example.com', fullName: 'Ada Admin', role: 'ADMIN', mustChangePassword: false, permissions: [], employeeId: null },
      }),
    )
    renderWithProviders(<LoginPage />, { path: '/login', routes: [{ path: '/', element: <p>Dashboard home</p> }] })
    await userEvent.type(await screen.findByLabelText('Email'), 'ada@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'Correct-passw0rd')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    await waitFor(() => expect(screen.getByText('Dashboard home')).toBeInTheDocument())
  })
})
