import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useQuery } from '@tanstack/react-query'
import { Boxes, Building2, ClipboardList, FileText, Loader2, Search, Truck, UserSquare2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useDebouncedValue } from '@/hooks/use-table-state'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { SearchHit } from '@/types/api'

const ICONS = {
  product: Boxes,
  customer: Building2,
  supplier: Truck,
  employee: UserSquare2,
  order: ClipboardList,
  invoice: FileText,
}

/** Global search (Ctrl/Cmd+K) across every module the user can read. */
export function CommandSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const debounced = useDebouncedValue(query.trim(), 250)
  const navigate = useNavigate()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const { data = [], isFetching } = useQuery({
    queryKey: ['search', debounced],
    queryFn: ({ signal }) => api.get<SearchHit[]>('/api/search', { q: debounced }, signal),
    enabled: open && debounced.length >= 2,
    staleTime: 30_000,
  })

  const go = (hit: SearchHit) => {
    setOpen(false)
    setQuery('')
    navigate(hit.link)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, data.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && data[active]) {
      e.preventDefault()
      go(data[active])
    }
  }

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setQuery('')
      }}
    >
      <DialogPrimitive.Trigger asChild>
        <button
          type="button"
          className="flex h-8 w-full max-w-sm items-center gap-2 rounded-md border border-border bg-muted/60 px-2.5 text-[13px] text-subtle-foreground transition-colors hover:bg-muted"
        >
          <Search className="size-4" aria-hidden />
          <span className="flex-1 text-left">Search…</span>
          <kbd className="hidden rounded border border-border bg-card px-1.5 font-sans text-[11px] sm:inline">Ctrl K</kbd>
        </button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 animate-in" />
        <DialogPrimitive.Content className="fixed top-[12vh] left-1/2 z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-popover shadow-lg animate-in">
          <DialogPrimitive.Title className="sr-only">Search</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Search products, customers, suppliers, employees, orders and invoices
          </DialogPrimitive.Description>
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="size-4 text-subtle-foreground" aria-hidden />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setActive(0)
              }}
              onKeyDown={onKeyDown}
              placeholder="Search products, customers, orders, invoices…"
              className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-subtle-foreground"
              role="combobox"
              aria-expanded={data.length > 0}
              aria-controls="search-results"
              aria-activedescendant={data[active] ? `hit-${active}` : undefined}
            />
            {isFetching && <Loader2 className="size-4 animate-spin text-subtle-foreground" aria-hidden />}
          </div>
          <ul id="search-results" role="listbox" className="max-h-80 overflow-y-auto p-1.5">
            {debounced.length < 2 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">Type at least 2 characters.</li>}
            {debounced.length >= 2 && !isFetching && data.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">No results for “{debounced}”.</li>
            )}
            {data.map((hit, i) => {
              const Icon = ICONS[hit.type]
              return (
                <li
                  key={`${hit.type}-${hit.id}`}
                  id={`hit-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(hit)}
                  className={cn('flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2', i === active && 'bg-muted')}
                >
                  <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{hit.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{hit.subtitle}</p>
                  </div>
                  <span className="text-[11px] text-subtle-foreground capitalize">{hit.type}</span>
                </li>
              )
            })}
          </ul>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
