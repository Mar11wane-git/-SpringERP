import { Plus } from 'lucide-react'
import { Link } from 'react-router-dom'

import { DataTable, FilterSelect, SearchInput, type Column } from '@/components/data-table/data-table'
import { PageHeader } from '@/components/layout/app-shell'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/features/auth/auth-context'
import { usePagedQuery } from '@/hooks/use-paged-query'
import { useTableState } from '@/hooks/use-table-state'
import { formatDate, formatMoney, humanize } from '@/lib/format'
import { ORDER_STATUSES, type OrderSummary } from '@/types/api'

export default function OrdersPage() {
  const { can } = useAuth()
  const table = useTableState({ status: '', from: '', to: '' }, { key: 'orderDate', direction: 'desc' })
  const query = usePagedQuery<OrderSummary>('sales-orders', '/api/sales-orders', table.params)

  const columns: Column<OrderSummary>[] = [
    {
      id: 'number',
      header: 'Order',
      sortKey: 'orderNumber',
      pinned: true,
      cell: (o) => (
        <Link to={`/sales/orders/${o.id}`} className="font-medium hover:underline">
          {o.orderNumber}
        </Link>
      ),
    },
    { id: 'customer', header: 'Customer', cell: (o) => <Link to={`/customers/${o.customer.id}`} className="hover:underline">{o.customer.name}</Link> },
    { id: 'date', header: 'Date', sortKey: 'orderDate', cell: (o) => formatDate(o.orderDate) },
    { id: 'status', header: 'Status', sortKey: 'status', cell: (o) => <StatusBadge status={o.status} /> },
    { id: 'total', header: 'Total', sortKey: 'total', align: 'right', cell: (o) => <span className="font-medium">{formatMoney(o.total, o.currency)}</span> },
  ]

  return (
    <>
      <PageHeader
        title="Orders & quotes"
        description="Drafts are quotes; confirming an order reserves and ships the stock."
        actions={
          can('SALES_WRITE') && (
            <Button asChild>
              <Link to="/sales/orders/new">
                <Plus />
                New quote
              </Link>
            </Button>
          )
        }
      />
      <DataTable
        tableId="orders"
        columns={columns}
        page={query.data}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        sort={table.sort}
        onSort={table.toggleSort}
        onPageChange={table.setPage}
        pageSize={table.size}
        onPageSizeChange={table.setSize}
        rowKey={(o) => o.id}
        rowHref={(o) => `/sales/orders/${o.id}`}
        emptyTitle="No orders found"
        emptyDescription="Adjust the filters or create a new quote."
        toolbar={
          <>
            <SearchInput value={table.search} onChange={table.setSearch} placeholder="Search number or customer" />
            <FilterSelect
              label="Status"
              value={String(table.filters.status)}
              onChange={(v) => table.setFilter('status', v)}
              options={ORDER_STATUSES.map((s) => ({ value: s, label: s === 'DRAFT' ? 'Draft / quote' : humanize(s) }))}
            />
            <Input type="date" aria-label="From" className="h-8 w-auto text-[13px]" value={String(table.filters.from)} onChange={(e) => table.setFilter('from', e.target.value)} />
            <Input type="date" aria-label="To" className="h-8 w-auto text-[13px]" value={String(table.filters.to)} onChange={(e) => table.setFilter('to', e.target.value)} />
          </>
        }
      />
    </>
  )
}
