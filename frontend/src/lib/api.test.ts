import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api, ApiError, session } from './api'

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('api client', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    session.set('expired-token')
  })
  afterEach(() => {
    fetchMock.mockReset()
    vi.unstubAllGlobals()
    session.set(null)
  })

  it('sends the bearer token and the anti-CSRF header', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { ok: true }))
    await api.get('/api/products', { search: 'chair', page: 0, empty: '' })
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/products?search=chair&page=0')
    const headers = init!.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer expired-token')
    expect(headers['X-Requested-With']).toBe('XMLHttpRequest')
  })

  it('refreshes once on 401 and replays the request with the new token', async () => {
    fetchMock
      .mockResolvedValueOnce(json(401, { code: 'UNAUTHORIZED' }))
      .mockResolvedValueOnce(json(200, { accessToken: 'fresh', user: {} }))
      .mockResolvedValueOnce(json(200, { id: 7 }))

    await expect(api.get<{ id: number }>('/api/products/7')).resolves.toEqual({ id: 7 })
    expect(fetchMock.mock.calls[1]![0]).toBe('/api/auth/refresh')
    const retried = fetchMock.mock.calls[2]![1]!.headers as Record<string, string>
    expect(retried.Authorization).toBe('Bearer fresh')
    expect(session.token).toBe('fresh')
  })

  it('ends the session when the refresh fails', async () => {
    const onChange = vi.fn()
    const unsubscribe = session.subscribe(onChange)
    fetchMock.mockResolvedValueOnce(json(401, {})).mockResolvedValueOnce(json(401, {}))

    await expect(api.get('/api/products')).rejects.toBeInstanceOf(ApiError)
    expect(onChange).toHaveBeenCalledWith(null)
    unsubscribe()
  })

  it('maps problem details to ApiError with field errors', async () => {
    fetchMock.mockResolvedValueOnce(
      json(400, {
        code: 'VALIDATION_FAILED',
        detail: 'Request validation failed.',
        errors: [{ field: 'sku', message: 'must not be blank' }],
        correlationId: 'abc-123-def',
      }),
    )
    const error = await api.post('/api/products', {}).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).code).toBe('VALIDATION_FAILED')
    expect((error as ApiError).fieldErrors).toEqual([{ field: 'sku', message: 'must not be blank' }])
    expect((error as ApiError).correlationId).toBe('abc-123-def')
  })
})
