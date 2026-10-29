import { DataTable, FilterSelect, SearchInput, type Column } from '@/components/data-table/data-table'
import { PageHeader } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { usePagedQuery } from '@/hooks/use-paged-query'
import { useTableState } from '@/hooks/use-table-state'
import { formatDateTime, humanize } from '@/lib/format'
import type { AuditEvent } from '@/types/api'

const ACTIONS = [
  'LOGIN_SUCCESS', 'LOGIN_FAILED', 'ACCOUNT_LOCKED', 'LOGOUT', 'TOKEN_REUSE_DETECTED', 'PASSWORD_CHANGED', 'PASSWORD_RESET',
  'USER_CREATED', 'USER_ROLE_CHANGED', 'USER_ACTIVATED', 'USER_DEACTIVATED', 'COMPANY_UPDATED', 'EMPLOYEE_CREATED',
  'EMPLOYEE_UPDATED', 'EMPLOYEE_STATUS_CHANGED', 'EMPLOYEE_DOCUMENT_UPLOADED', 'EMPLOYEE_DOCUMENT_DELETED', 'LEAVE_REQUESTED',
  'LEAVE_APPROVED', 'LEAVE_REJECTED', 'LEAVE_CANCELLED', 'PRODUCT_SAVED', 'STOCK_MOVEMENT', 'PARTNER_SAVED', 'ORDER_CREATED',
  'ORDER_CONFIRMED', 'ORDER_COMPLETED', 'ORDER_CANCELLED', 'INVOICE_ISSUED', 'INVOICE_CANCELLED', 'PAYMENT_RECORDED', 'DATA_EXPORTED',
]
const SECURITY = new Set(['LOGIN_FAILED', 'ACCOUNT_LOCKED', 'TOKEN_REUSE_DETECTED', 'PASSWORD_RESET', 'USER_ROLE_CHANGED', 'USER_DEACTIVATED'])

export default function AuditPage() {
  const table = useTableState({ action: '', from: '', to: '' }, { key: 'occurredAt', direction: 'desc' }, 50)
  const query = usePagedQuery<AuditEvent>('audit', '/api/audit-events', table.params)
  const columns: Column<AuditEvent>[] = [
    { id: 'when', header: 'When', sortKey: 'occurredAt', pinned: true, cell: (e) => <span className="whitespace-nowrap">{formatDateTime(e.occurredAt)}</span> },
    { id: 'action', header: 'Action', sortKey: 'action', cell: (e) => <Badge tone={SECURITY.has(e.action) ? 'warning' : 'neutral'}>{humanize(e.action)}</Badge> },
    { id: 'summary', header: 'Summary', cell: (e) => <span className="block max-w-md">{e.summary}</span> },
    { id: 'actor', header: 'Actor', cell: (e) => e.actorEmail ?? <span className="text-muted-foreground">System</span> },
    { id: 'entity', header: 'Entity', defaultHidden: true, cell: (e) => (e.entityType ? `${e.entityType} #${e.entityId}` : '—') },
    { id: 'ip', header: 'IP', defaultHidden: true, cell: (e) => <span className="font-mono text-xs">{e.ipAddress ?? '—'}</span> },
    { id: 'correlation', header: 'Correlation id', defaultHidden: true, cell: (e) => <span className="font-mono text-xs">{e.correlationId ?? '—'}</span> },
  ]
  return (
    <>
      <PageHeader title="Audit log" description="Append-only record of sign-ins, security events and business actions." />
      <DataTable
        tableId="audit"
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
        rowKey={(e) => e.id}
        emptyTitle="No events match"
        toolbar={
          <>
            <SearchInput value={table.search} onChange={table.setSearch} placeholder="Search summary or actor" />
            <FilterSelect label="Action" value={String(table.filters.action)} onChange={(v) => table.setFilter('action', v)} options={ACTIONS.map((a) => ({ value: a, label: humanize(a) }))} />
            <Input type="date" aria-label="From" className="h-8 w-auto text-[13px]" value={String(table.filters.from)} onChange={(e) => table.setFilter('from', e.target.value)} />
            <Input type="date" aria-label="To" className="h-8 w-auto text-[13px]" value={String(table.filters.to)} onChange={(e) => table.setFilter('to', e.target.value)} />
          </>
        }
      />
    </>
  )
}
