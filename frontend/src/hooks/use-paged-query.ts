import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { api, type QueryParams } from '@/lib/api'
import type { Page } from '@/types/api'

/**
 * Paged list query. The first key segment is the resource name, so a mutation can
 * invalidate every list of that resource with invalidateQueries({ queryKey: [resource] }).
 */
export function usePagedQuery<T>(resource: string, path: string, params: QueryParams, enabled = true) {
  return useQuery({
    queryKey: [resource, 'list', path, params],
    queryFn: ({ signal }) => api.get<Page<T>>(path, params, signal),
    placeholderData: keepPreviousData,
    enabled,
  })
}

/** Small option lists for pickers (first page, sorted by name). */
export function useOptions<T>(resource: string, path: string, params: QueryParams = {}, enabled = true) {
  return useQuery({
    queryKey: [resource, 'options', path, params],
    queryFn: () => api.get<Page<T>>(path, { size: 100, sort: 'name,asc', ...params }),
    staleTime: 60_000,
    enabled,
    select: (page) => page.content,
  })
}
