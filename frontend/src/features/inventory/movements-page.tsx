import { DataTable, FilterSelect } from '@/components/data-table/data-table'
import { PageHeader } from '@/components/layout/app-shell'
import { Input } from '@/components/ui/input'
import { useCurrency } from '@/hooks/use-company'
import { usePagedQuery } from '@/hooks/use-paged-query'
import { useTableState } from '@/hooks/use-table-state'
import { humanize } from '@/lib/format'
import { MOVEMENT_TYPES, type StockMovement } from '@/types/api'

import { movementColumns } from './movement-columns'

/** Company-wide stock ledger. Entries are immutable; corrections are new adjustments. */
export default function MovementsPage() {
  const currency = useCurrency()
  const table = useTableState({ type: '', from: '', to: '' }, { key: 'createdAt', direction: 'desc' })
  const query = usePagedQuery<StockMovement>('stock-movements', '/api/stock-movements', table.params)

  return (
    <>
      <PageHeader title="Stock movements" description="Every change to on-hand quantities, with the resulting balance." />
      <DataTable
        tableId="movements"
        columns={movementColumns(currency, true)}
        page={query.data}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        sort={table.sort}
        onSort={table.toggleSort}
        onPageChange={table.setPage}
        pageSize={table.size}
        onPageSizeChange={table.setSize}
        rowKey={(m) => m.id}
        emptyTitle="No movements in this period"
        toolbar={
          <>
            <FilterSelect
              label="Type"
              value={String(table.filters.type)}
              onChange={(v) => table.setFilter('type', v)}
              options={MOVEMENT_TYPES.map((t) => ({ value: t, label: humanize(t) }))}
            />
            <Input type="date" aria-label="From" className="h-8 w-auto text-[13px]" value={String(table.filters.from)} onChange={(e) => table.setFilter('from', e.target.value)} />
            <Input type="date" aria-label="To" className="h-8 w-auto text-[13px]" value={String(table.filters.to)} onChange={(e) => table.setFilter('to', e.target.value)} />
          </>
        }
      />
    </>
  )
}
