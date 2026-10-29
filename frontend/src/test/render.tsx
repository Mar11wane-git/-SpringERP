import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { ThemeProvider } from '@/app/theme'
import { AuthProvider } from '@/features/auth/auth-context'

/**
 * Renders a component inside the real providers. Uses the declarative MemoryRouter:
 * the data router builds fetch Request objects on navigation, which Node's undici
 * rejects under jsdom (foreign AbortSignal). Pages needing useBlocker are not covered here.
 */
export function renderWithProviders(ui: ReactElement, { path = '/', routes = [] as { path: string; element: ReactElement }[] } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <ThemeProvider>
      <QueryClientProvider client={client}>
        <AuthProvider>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path={path} element={ui} />
              {routes.map((r) => (
                <Route key={r.path} path={r.path} element={r.element} />
              ))}
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )
}
