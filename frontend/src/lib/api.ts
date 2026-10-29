import type { TokenResponse } from '@/types/api'

/**
 * Centralised API client.
 *
 * - The short-lived access token lives only in memory (never in localStorage).
 * - The long-lived refresh token is an HttpOnly cookie the browser sends to /api/auth only.
 * - On a 401 the client refreshes once (single-flight, shared by concurrent calls)
 *   and replays the request; if refresh fails, the session is over.
 */

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''

export interface FieldError {
  field: string
  message: string
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly fieldErrors: FieldError[]
  readonly correlationId?: string

  constructor(status: number, code: string, message: string, fieldErrors: FieldError[] = [], correlationId?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fieldErrors = fieldErrors
    this.correlationId = correlationId
  }
}

type Listener = (token: string | null) => void

let accessToken: string | null = null
const listeners = new Set<Listener>()
let refreshInFlight: Promise<TokenResponse | null> | null = null

export const session = {
  get token() {
    return accessToken
  },
  set(token: string | null) {
    accessToken = token
    listeners.forEach((l) => l(token))
  },
  /** Notified with null when the session ends (refresh failed or logout). */
  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}

export type QueryParams = Record<string, string | number | boolean | null | undefined>

function buildUrl(path: string, params?: QueryParams) {
  const query = new URLSearchParams()
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') query.set(key, String(value))
    }
  }
  const qs = query.toString()
  return `${BASE_URL}${path}${qs ? `?${qs}` : ''}`
}

async function toApiError(res: Response): Promise<ApiError> {
  let body: { detail?: string; code?: string; errors?: FieldError[]; correlationId?: string } = {}
  try {
    body = await res.json()
  } catch {
    /* non-JSON error body (proxy, network) */
  }
  const fallback = res.status >= 500 ? 'The server could not complete the request.' : `Request failed (${res.status}).`
  return new ApiError(res.status, body.code ?? `HTTP_${res.status}`, body.detail ?? fallback, body.errors ?? [],
    body.correlationId)
}

/** Exchanges the refresh cookie for a new access token. Resolves null when no session exists. */
export function refreshSession(): Promise<TokenResponse | null> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(buildUrl('/api/auth/refresh'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    })
      .then(async (res) => {
        if (!res.ok) {
          session.set(null)
          return null
        }
        const data = (await res.json()) as TokenResponse
        session.set(data.accessToken)
        return data
      })
      .catch(() => {
        session.set(null)
        return null
      })
      .finally(() => {
        refreshInFlight = null
      })
  }
  return refreshInFlight
}

interface RequestOptions {
  params?: QueryParams
  body?: unknown
  signal?: AbortSignal
}

async function send(method: string, path: string, options: RequestOptions, retried = false): Promise<Response> {
  const headers: Record<string, string> = { 'X-Requested-With': 'XMLHttpRequest' }
  const isForm = options.body instanceof FormData
  if (options.body !== undefined && !isForm) headers['Content-Type'] = 'application/json'
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`

  const res = await fetch(buildUrl(path, options.params), {
    method,
    headers,
    credentials: 'include',
    signal: options.signal,
    body: options.body === undefined ? undefined : isForm ? (options.body as FormData) : JSON.stringify(options.body),
  })

  if (res.status === 401 && !retried && !path.startsWith('/api/auth/')) {
    const refreshed = await refreshSession()
    if (refreshed) return send(method, path, options, true)
  }
  if (!res.ok) throw await toApiError(res)
  return res
}

async function json<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const res = await send(method, path, options)
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export const api = {
  get: <T>(path: string, params?: QueryParams, signal?: AbortSignal) => json<T>('GET', path, { params, signal }),
  post: <T>(path: string, body?: unknown) => json<T>('POST', path, { body }),
  put: <T>(path: string, body: unknown) => json<T>('PUT', path, { body }),
  patch: <T>(path: string, body: unknown) => json<T>('PATCH', path, { body }),
  delete: (path: string) => json<void>('DELETE', path),
  upload: <T>(path: string, form: FormData, params?: QueryParams) => json<T>('POST', path, { body: form, params }),

  /** Fetches a binary (PDF, CSV) and saves or opens it, keeping the bearer token out of URLs. */
  async download(path: string, params?: QueryParams, mode: 'save' | 'open' = 'save') {
    const res = await send('GET', path, { params })
    const blob = await res.blob()
    const disposition = res.headers.get('Content-Disposition') ?? ''
    const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition)
    const filename = match?.[1] ? decodeURIComponent(match[1]) : 'download'
    const url = URL.createObjectURL(blob)
    if (mode === 'open') {
      window.open(url, '_blank', 'noopener')
    } else {
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  },
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error && error.name !== 'AbortError') return 'Network error. Check your connection and retry.'
  return 'Something went wrong.'
}
