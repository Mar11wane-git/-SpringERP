import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/** Label/value grid used on detail pages. */
export function DefinitionList({ items, className }: { items: [string, ReactNode][]; className?: string }) {
  return (
    <dl className={cn('grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2', className)}>
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="mt-0.5 truncate text-sm">{value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  )
}
