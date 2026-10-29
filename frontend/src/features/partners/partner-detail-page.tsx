import { useQuery } from '@tanstack/react-query'
import { Pencil, Plus } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

import { DataTable, type Column } from '@/components/data-table/data-table'
import { PageHeader } from '@/components/layout/app-shell'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { DefinitionList } from '@/components/ui/definition-list'
import { ErrorState, Skeleton } from '@/components/ui/feedback'
import { useAuth } from '@/features/auth/auth-context'
import { useCurrency } from '@/hooks/use-company'
import { usePagedQuery } from '@/hooks/use-paged-query'
import { useTableState } from '@/hooks/use-table-state'
import { api } from '@/lib/api'
import { formatDate, formatMoney } from '@/lib/format'
import type { InvoiceSummary, OrderSummary, Partner, Product } from '@/types/api'

import { PartnerFormDialog, type PartnerKind } from './partner-form-dialog'

function CustomerHistory({ customerId }: { customerId: number }) {
  const { can } = useAuth()
  const orders = useTableState({ customerId }, { key: 'orderDate', direction: 'desc' }, 10)
  const invoices = useTableState({ customerId }, { key: 'issueDate', direction: 'desc' }, 10)
  const orderQuery = usePagedQuery<OrderSummary>('sales-orders', '/api/sales-orders', orders.params, can('SALES_READ'))
  const invoiceQuery = usePagedQuery<InvoiceSummary>('invoices', '/api/invoices', invoices.params, can('INVOICE_READ'))

  const orderColumns: Column<OrderSummary>[] = [
    { id: 'number', header: 'Order', pinned: true, cell: (o) => <Link to={`/sales/orders/${o.id}`} className="font-medium hover:underline">{o.orderNumber}</Link> },
    { id: 'date', header: 'Date', sortKey: 'orderDate', cell: (o) => formatDate(o.orderDate) },
    { id: 'status', header: 'Status', cell: (o) => <StatusBadge status={o.status} /> },
    { id: 'total', header: 'Total', align: 'right', sortKey: 'total', cell: (o) => formatMoney(o.total, o.currency) },
  ]
  const invoiceColumns: Column<InvoiceSummary>[] = [
    { id: 'number', header: 'Invoice', pinned: true, cell: (i) => <Link to={`/invoices/${i.id}`} className="font-medium hover:underline">{i.invoiceNumber}</Link> },
    { id: 'due', header: 'Due', sortKey: 'dueDate', cell: (i) => formatDate(i.dueDate) },
    { id: 'status', header: 'Status', cell: (i) => <StatusBadge status={i.overdue ? 'OVERDUE' : i.status} /> },
    { id: 'balance', header: 'Balance', align: 'right', cell: (i) => formatMoney(i.balanceDue, i.currency) },
  ]

  return (
    <div className="space-y-6">
      {can('SALES_READ') && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Orders</h2>
            {can('SALES_WRITE') && (
              <Button size="sm" asChild>
                <Link to={`/sales/orders/new?customerId=${customerId}`}>
                  <Plus />
                  New order
                </Link>
              </Button>
            )}
          </div>
          <DataTable tableId="customer-orders" columns={orderColumns} page={orderQuery.data} isLoading={orderQuery.isLoading} error={orderQuery.error} onRetry={() => void orderQuery.refetch()} sort={orders.sort} onSort={orders.toggleSort} onPageChange={orders.setPage} pageSize={orders.size} onPageSizeChange={orders.setSize} rowKey={(o) => o.id} rowHref={(o) => `/sales/orders/${o.id}`} emptyTitle="No orders yet" />
        </section>
      )}
      {can('INVOICE_READ') && (
        <section>
          <h2 className="mb-3 text-sm font-semibold">Invoices</h2>
          <DataTable tableId="customer-invoices" columns={invoiceColumns} page={invoiceQuery.data} isLoading={invoiceQuery.isLoading} error={invoiceQuery.error} onRetry={() => void invoiceQuery.refetch()} sort={invoices.sort} onSort={invoices.toggleSort} onPageChange={invoices.setPage} pageSize={invoices.size} onPageSizeChange={invoices.setSize} rowKey={(i) => i.id} rowHref={(i) => `/invoices/${i.id}`} emptyTitle="No invoices yet" />
        </section>
      )}
    </div>
  )
}

function SupplierProducts({ supplierId }: { supplierId: number }) {
  const { can } = useAuth()
  const currency = useCurrency()
  const table = useTableState({ supplierId }, { key: 'name', direction: 'asc' }, 10)
  const query = usePagedQuery<Product>('products', '/api/products', table.params, can('INVENTORY_READ'))
  if (!can('INVENTORY_READ')) return null
  const columns: Column<Product>[] = [
    { id: 'name', header: 'Product', sortKey: 'name', pinned: true, cell: (p) => <Link to={`/inventory/products/${p.id}`} className="font-medium hover:underline">{p.name}</Link> },
    { id: 'sku', header: 'SKU', sortKey: 'sku', cell: (p) => p.sku },
    { id: 'cost', header: 'Cost', align: 'right', cell: (p) => formatMoney(p.costPrice, currency) },
    { id: 'stock', header: 'On hand', align: 'right', sortKey: 'quantityOnHand', cell: (p) => `${p.quantityOnHand} ${p.unit}` },
  ]
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold">Products with this preferred supplier</h2>
      <DataTable tableId="supplier-products" columns={columns} page={query.data} isLoading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} sort={table.sort} onSort={table.toggleSort} onPageChange={table.setPage} pageSize={table.size} onPageSizeChange={table.setSize} rowKey={(p) => p.id} rowHref={(p) => `/inventory/products/${p.id}`} emptyTitle="No products linked yet" />
    </section>
  )
}

export default function PartnerDetailPage({ kind }: { kind: PartnerKind }) {
  const { id } = useParams()
  const { can } = useAuth()
  const { data: partner, isLoading, error, refetch } = useQuery({
    queryKey: [kind, Number(id)],
    queryFn: () => api.get<Partner>(`/api/${kind}/${id}`),
  })
  if (isLoading) return <Skeleton className="h-96" />
  if (error || !partner) return <ErrorState error={error} onRetry={() => void refetch()} />

  const address = [partner.addressLine, [partner.postalCode, partner.city].filter(Boolean).join(' '), partner.country]
    .filter(Boolean)
    .join(', ')

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            {partner.name}
            <StatusBadge status={partner.active ? 'ACTIVE' : 'INACTIVE'} />
          </span>
        }
        description={partner.code}
        actions={
          can('PARTNER_WRITE') && (
            <PartnerFormDialog
              kind={kind}
              partner={partner}
              trigger={
                <Button variant="secondary">
                  <Pencil />
                  Edit
                </Button>
              }
            />
          )
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Contact details" />
          <CardBody>
            <DefinitionList
              className="sm:grid-cols-1"
              items={[
                ['Contact person', partner.contactName],
                ['Email', partner.email ? <a href={`mailto:${partner.email}`} className="text-primary hover:underline">{partner.email}</a> : null],
                ['Phone', partner.phone],
                ['Address', address || null],
                ['Tax ID', partner.taxId],
                ['Added', formatDate(partner.createdAt)],
                ['Notes', partner.notes ? <span className="whitespace-pre-wrap">{partner.notes}</span> : null],
              ]}
            />
          </CardBody>
        </Card>
        <div className="lg:col-span-2">
          {kind === 'customers' ? <CustomerHistory customerId={partner.id} /> : <SupplierProducts supplierId={partner.id} />}
        </div>
      </div>
    </>
  )
}
