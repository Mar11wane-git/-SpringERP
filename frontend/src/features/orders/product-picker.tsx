import { useQuery } from '@tanstack/react-query'
import { useId, useState } from 'react'

import { Input } from '@/components/ui/input'
import { useDebouncedValue } from '@/hooks/use-table-state'
import { api } from '@/lib/api'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Page, Product } from '@/types/api'

interface ProductPickerProps {
  value: Product | null
  onChange: (product: Product) => void
  currency: string
  invalid?: boolean
  label: string
}

/** Server-side searchable product combobox (works for catalogs of any size). */
export function ProductPicker({ value, onChange, currency, invalid, label }: ProductPickerProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const debounced = useDebouncedValue(query.trim(), 200)
  const listId = useId()

  const { data: options = [], isFetching } = useQuery({
    queryKey: ['products', 'picker', debounced],
    queryFn: () => api.get<Page<Product>>('/api/products', { search: debounced || undefined, active: true, size: 8, sort: 'name,asc' }),
    enabled: open,
    select: (p) => p.content,
    staleTime: 30_000,
  })

  const choose = (p: Product) => {
    onChange(p)
    setQuery('')
    setOpen(false)
  }

  return (
    <div className="relative">
      <Input
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={listId}
        aria-invalid={invalid || undefined}
        aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
        value={open ? query : value ? `${value.name} (${value.sku})` : ''}
        placeholder="Search product…"
        onFocus={() => {
          setOpen(true)
          setActive(0)
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => {
          setQuery(e.target.value)
          setActive(0)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((i) => Math.min(i + 1, options.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((i) => Math.max(i - 1, 0))
          } else if (e.key === 'Enter' && open && options[active]) {
            e.preventDefault()
            choose(options[active])
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full min-w-72 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-lg"
        >
          {!isFetching && options.length === 0 && <li className="px-2.5 py-2 text-sm text-muted-foreground">No active product found.</li>}
          {options.map((p, i) => (
            <li
              key={p.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault()
                choose(p)
              }}
              onMouseEnter={() => setActive(i)}
              className={cn('flex cursor-pointer items-center justify-between gap-3 rounded px-2.5 py-1.5', i === active && 'bg-muted')}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm">{p.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {p.sku} · {p.quantityOnHand} {p.unit} in stock
                </span>
              </span>
              <span className="text-xs tabular">{formatMoney(p.unitPrice, currency)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
