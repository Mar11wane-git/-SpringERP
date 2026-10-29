import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, Columns3, Search } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback'
import { Input, Select } from '@/components/ui/input'
import type { SortState } from '@/hooks/use-table-state'
import { formatNumber } from '@/lib/format'
import { cn, safeStorage } from '@/lib/utils'
import type { Page } from '@/types/api'

export interface Column<T> {
  id: string
  header: string
  cell: (row: T) => ReactNode
  /** Backend sort property; omit for non-sortable columns. */
  sortKey?: string
  align?: 'left' | 'right'
  className?: string
  /** Hidden by default, toggleable from the column menu. */
  defaultHidden?: boolean
  /** Column cannot be hidden (identifying column). */
  pinned?: boolean
}

interface DataTableProps<T> {
  /** Stable id: column visibility is remembered per table. */
  tableId: string
  columns: Column<T>[]
  page: Page<T> | undefined
  isLoading: boolean
  error: unknown
  onRetry: () => void
  sort?: SortState
  onSort?: (key: string) => void
  onPageChange: (page: number) => void
  pageSize: number
  onPageSizeChange: (size: number) => void
  rowKey: (row: T) => string | number
  rowHref?: (row: T) => string
  emptyTitle: string
  emptyDescription?: string
  emptyAction?: ReactNode
  toolbar?: ReactNode
}

const PAGE_SIZES = [10, 20, 50, 100]

function loadHidden(tableId: string, columns: Column<unknown>[]): Set<string> {
  const saved = safeStorage.get(`table:${tableId}:hidden`)
  if (saved) {
    try {
      return new Set(JSON.parse(saved) as string[])
    } catch {
      /* fall through to defaults */
    }
  }
  return new Set(columns.filter((c) => c.defaultHidden).map((c) => c.id))
}

export function DataTable<T>(props: DataTableProps<T>) {
  const { tableId, columns, page, isLoading, error, onRetry, sort, onSort, rowKey, rowHref } = props
  const navigate = useNavigate()
  const [hidden, setHidden] = useState<Set<string>>(() => loadHidden(tableId, columns as Column<unknown>[]))
  const visible = columns.filter((c) => !hidden.has(c.id))

  const toggleColumn = (id: string) => {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      safeStorage.set(`table:${tableId}:hidden`, JSON.stringify([...next]))
      return next
    })
  }

  const rows = page?.content ?? []
  const from = page && page.totalElements > 0 ? page.page * page.size + 1 : 0
  const to = page ? page.page * page.size + rows.length : 0

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-xs">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2.5">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{props.toolbar}</div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" aria-label="Choose columns">
              <Columns3 />
              <span className="hidden sm:inline">Columns</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
            {columns
              .filter((c) => !c.pinned)
              .map((c) => (
                <DropdownMenuCheckboxItem
                  key={c.id}
                  checked={!hidden.has(c.id)}
                  onCheckedChange={() => toggleColumn(c.id)}
                  onSelect={(e) => e.preventDefault()}
                >
                  {c.header}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              {visible.map((c) => {
                const active = sort?.key === c.sortKey
                const ariaSort = active ? (sort?.direction === 'asc' ? 'ascending' : 'descending') : undefined
                return (
                  <th
                    key={c.id}
                    scope="col"
                    aria-sort={ariaSort}
                    className={cn(
                      'h-9 px-3 text-left text-xs font-medium whitespace-nowrap text-muted-foreground',
                      c.align === 'right' && 'text-right',
                      c.className,
                    )}
                  >
                    {c.sortKey && onSort ? (
                      <button
                        type="button"
                        onClick={() => onSort(c.sortKey!)}
                        className={cn(
                          'inline-flex items-center gap-1 rounded hover:text-foreground',
                          active && 'text-foreground',
                        )}
                      >
                        {c.header}
                        {active ? (
                          sort?.direction === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
                        ) : (
                          <ChevronsUpDown className="size-3 opacity-50" />
                        )}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 6 }, (_, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  {visible.map((c) => (
                    <td key={c.id} className="h-11 px-3">
                      <Skeleton className="h-4 w-3/4" />
                    </td>
                  ))}
                </tr>
              ))}
            {!isLoading &&
              !error &&
              rows.map((row) => {
                const href = rowHref?.(row)
                return (
                  <tr
                    key={rowKey(row)}
                    className={cn(
                      'border-b border-border transition-colors last:border-0',
                      href && 'cursor-pointer hover:bg-muted/60',
                    )}
                    onClick={
                      href
                        ? (e) => {
                            // Let inner links/buttons handle their own clicks.
                            if ((e.target as HTMLElement).closest('a,button,input,select')) return
                            navigate(href)
                          }
                        : undefined
                    }
                  >
                    {visible.map((c) => (
                      <td
                        key={c.id}
                        className={cn('h-11 px-3 py-2 align-middle', c.align === 'right' && 'text-right tabular', c.className)}
                      >
                        {c.cell(row)}
                      </td>
                    ))}
                  </tr>
                )
              })}
          </tbody>
        </table>
        {!isLoading && !!error && <ErrorState error={error} onRetry={onRetry} />}
        {!isLoading && !error && rows.length === 0 && (
          <EmptyState title={props.emptyTitle} description={props.emptyDescription} action={props.emptyAction} />
        )}
      </div>

      {page && page.totalElements > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-3 py-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="tabular">
              {formatNumber(from)}–{formatNumber(to)} of {formatNumber(page.totalElements)}
            </span>
            <label className="flex items-center gap-1.5">
              <span className="sr-only sm:not-sr-only">Rows</span>
              <Select
                value={props.pageSize}
                onChange={(e) => props.onPageSizeChange(Number(e.target.value))}
                className="h-7 w-[4.5rem] text-xs"
                aria-label="Rows per page"
              >
                {PAGE_SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </label>
          </div>
          <div className="flex items-center gap-1">
            <span className="mr-2 tabular">
              Page {page.page + 1} of {Math.max(page.totalPages, 1)}
            </span>
            <Button
              variant="secondary"
              size="icon-sm"
              aria-label="Previous page"
              disabled={page.page === 0}
              onClick={() => props.onPageChange(page.page - 1)}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="secondary"
              size="icon-sm"
              aria-label="Next page"
              disabled={page.page + 1 >= page.totalPages}
              onClick={() => props.onPageChange(page.page + 1)}
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative w-full sm:w-64">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-subtle-foreground" aria-hidden />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-8 pl-8"
      />
    </div>
  )
}

export function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className="h-8 w-auto min-w-36 text-[13px]">
      <option value="">{label}: all</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  )
}
