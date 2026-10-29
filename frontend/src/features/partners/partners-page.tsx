import { Plus } from 'lucide-react'
import { Link } from 'react-router-dom'

import { DataTable, FilterSelect, SearchInput, type Column } from '@/components/data-table/data-table'
import { PageHeader } from '@/components/layout/app-shell'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-context'
import { usePagedQuery } from '@/hooks/use-paged-query'
import { useTableState } from '@/hooks/use-table-state'
import { formatDate } from '@/lib/format'
import type { Partner } from '@/types/api'

import { PartnerFormDialog, type PartnerKind } from './partner-form-dialog'

export default function PartnersPage({ kind }: { kind: PartnerKind }) {
  const { can } = useAuth()
  const title = kind === 'customers' ? 'Customers' : 'Suppliers'
  const table = useTableState({ active: 'true' }, { key: 'name', direction: 'asc' })
  const query = usePagedQuery<Partner>(kind, `/api/${kind}`, table.params)

  const columns: Column<Partner>[] = [
    {
      id: 'name',
      header: 'Name',
      sortKey: 'name',
      pinned: true,
      cell: (p) => (
        <Link to={`/${kind}/${p.id}`} className="block hover:underline">
          <span className="block font-medium">{p.name}</span>
          <span className="block text-xs text-muted-foreground">{p.code}</span>
        </Link>
      ),
    },
    { id: 'contact', header: 'Contact', cell: (p) => p.contactName ?? '—' },
    { id: 'email', header: 'Email', cell: (p) => (p.email ? <a href={`mailto:${p.email}`} className="hover:underline">{p.email}</a> : '—') },
    { id: 'phone', header: 'Phone', defaultHidden: true, cell: (p) => p.phone ?? '—' },
    { id: 'city', header: 'City', sortKey: 'city', cell: (p) => [p.city, p.country].filter(Boolean).join(', ') || '—' },
    { id: 'taxId', header: 'Tax ID', defaultHidden: true, cell: (p) => p.taxId ?? '—' },
    { id: 'created', header: 'Added', sortKey: 'createdAt', defaultHidden: true, cell: (p) => formatDate(p.createdAt) },
    { id: 'status', header: 'Status', cell: (p) => <StatusBadge status={p.active ? 'ACTIVE' : 'INACTIVE'} /> },
  ]

  return (
    <>
      <PageHeader
        title={title}
        description={kind === 'customers' ? 'Accounts you sell to.' : 'Companies you buy stock from.'}
        actions={
          can('PARTNER_WRITE') && (
            <PartnerFormDialog
              kind={kind}
              trigger={
                <Button>
                  <Plus />
                  New {kind === 'customers' ? 'customer' : 'supplier'}
                </Button>
              }
            />
          )
        }
      />
      <DataTable
        tableId={kind}
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
        rowKey={(p) => p.id}
        rowHref={(p) => `/${kind}/${p.id}`}
        emptyTitle={`No ${kind} found`}
        emptyDescription="Try another search or status filter."
        toolbar={
          <>
            <SearchInput value={table.search} onChange={table.setSearch} placeholder="Search name, code, email, city" />
            <FilterSelect
              label="Status"
              value={String(table.filters.active)}
              onChange={(v) => table.setFilter('active', v)}
              options={[
                { value: 'true', label: 'Active' },
                { value: 'false', label: 'Archived' },
              ]}
            />
          </>
        }
      />
    </>
  )
}
