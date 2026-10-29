import { useEffect, useMemo, useState } from 'react'

import type { QueryParams } from '@/lib/api'

export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

export interface SortState {
  key: string
  direction: 'asc' | 'desc'
}

/**
 * Server-side table state: search (debounced), filters, sort and paging.
 * Changing search, filters or page size returns to the first page.
 */
export function useTableState<F extends QueryParams>(initialFilters: F, initialSort?: SortState, initialSize = 20) {
  const [search, setSearchRaw] = useState('')
  const [filters, setFiltersRaw] = useState<F>(initialFilters)
  const [sort, setSort] = useState<SortState | undefined>(initialSort)
  const [page, setPage] = useState(0)
  const [size, setSizeRaw] = useState(initialSize)
  const debouncedSearch = useDebouncedValue(search)

  const params = useMemo<QueryParams>(
    () => ({
      ...filters,
      search: debouncedSearch.trim() || undefined,
      page,
      size,
      sort: sort ? `${sort.key},${sort.direction}` : undefined,
    }),
    [filters, debouncedSearch, page, size, sort],
  )

  return {
    params,
    search,
    setSearch: (value: string) => {
      setSearchRaw(value)
      setPage(0)
    },
    filters,
    setFilter: <K extends keyof F>(key: K, value: F[K]) => {
      setFiltersRaw((f) => ({ ...f, [key]: value }))
      setPage(0)
    },
    sort,
    toggleSort: (key: string) => {
      setSort((s) => (s?.key === key ? { key, direction: s.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' }))
    },
    page,
    setPage,
    size,
    setSize: (value: number) => {
      setSizeRaw(value)
      setPage(0)
    },
  }
}

export type TableState = ReturnType<typeof useTableState>
