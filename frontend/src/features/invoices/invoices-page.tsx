import { useMutation } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'

import { DataTable, FilterSelect, SearchInput, type Column } from '@/components/data-table/data-table'
import { PageHeader } from '@/components/layout/app-shell'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-context'
import { usePagedQuery } from '@/hooks/use-paged-query'
import { useTableState } from '@/hooks/use-table-state'
import { api } from '@/lib/api'
import { formatDate, formatMoney, humanize } from '@/lib/format'
import { handleMutationError } from '@/lib/mutations'
import { cn } from '@/lib/utils'
import { INVOICE_STATUSES, type InvoiceSummary } from '@/types/api'

export default function InvoicesPage() {
  const { can } = useAuth()
  const [searchParams] = useSearchParams()
  const table = useTableState(
    { status: '', overdue: searchParams.get('overdue') === 'true' ? 'true' : '', from: '', to: '' },
    { key: 'issueDate', direction: 'desc' },
  )
  const query = usePagedQuery<InvoiceSummary>('invoices', '/api/invoices', table.params)
  const exportCsv = useMutation({
    mutationFn: () => api.download('/api/invoices/export', { ...table.params, page: undefined, size: undefined }),
    onError: (e) => handleMutationError(e),
  })

  const columns: Column<InvoiceSummary>[] = [
    {
      id: 'number',
      header: 'Invoice',
      sortKey: 'invoiceNumber',
      pinned: true,
      cell: (i) => (
        <Link to={`/invoices/${i.id}`} className="font-medium hover:underline">
          {i.invoiceNumber}
        </Link>
      ),
    },
    { id: 'customer', header: 'Customer', cell: (i) => i.customer.name },
    { id: 'issued', header: 'Issued', sortKey: 'issueDate', cell: (i) => formatDate(i.issueDate) },
    {
      id: 'due',
      header: 'Due',
      sortKey: 'dueDate',
      cell: (i) => <span className={cn(i.overdue && 'font-medium text-destructive')}>{formatDate(i.dueDate)}</span>,
    },
    { id: 'status', header: 'Status', sortKey: 'status', cell: (i) => <StatusBadge status={i.overdue ? 'OVERDUE' : i.status} /> },
    { id: 'total', header: 'Total', sortKey: 'total', align: 'right', cell: (i) => formatMoney(i.total, i.currency) },
    { id: 'paid', header: 'Paid', align: 'right', defaultHidden: true, cell: (i) => formatMoney(i.amountPaid, i.currency) },
    { id: 'balance', header: 'Balance due', align: 'right', cell: (i) => <span className="font-medium">{formatMoney(i.balanceDue, i.currency)}</span> },
  ]

  return (
    <>
      <PageHeader
        title="Invoices"
        description="Issued from confirmed orders. Payments are recorded as they are received."
        actions={
          can('REPORT_READ') && (
            <Button variant="secondary" onClick={() => exportCsv.mutate()} loading={exportCsv.isPending}>
              <Download />
              Export CSV
            </Button>
          )
        }
      />
      <DataTable
        tableId="invoices"
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
        rowKey={(i) => i.id}
        rowHref={(i) => `/invoices/${i.id}`}
        emptyTitle="No invoices found"
        emptyDescription="Invoices are created from confirmed orders."
        toolbar={
          <>
            <SearchInput value={table.search} onChange={table.setSearch} placeholder="Search number or customer" />
            <FilterSelect
              label="Status"
              value={String(table.filters.status)}
              onChange={(v) => table.setFilter('status', v)}
              options={INVOICE_STATUSES.map((s) => ({ value: s, label: humanize(s) }))}
            />
            <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <input
                type="checkbox"
                className="size-4 accent-[var(--primary)]"
                checked={table.filters.overdue === 'true'}
                onChange={(e) => table.setFilter('overdue', e.target.checked ? 'true' : '')}
              />
              Overdue only
            </label>
          </>
        }
      />
    </>
  )
}
