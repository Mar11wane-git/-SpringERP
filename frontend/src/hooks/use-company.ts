import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'
import type { Company } from '@/types/api'

export function useCompany() {
  return useQuery({
    queryKey: ['company'],
    queryFn: () => api.get<Company>('/api/company'),
    staleTime: 5 * 60_000,
  })
}

/** Company currency for display; falls back to EUR while loading. */
export function useCurrency() {
  return useCompany().data?.currency ?? 'EUR'
}
