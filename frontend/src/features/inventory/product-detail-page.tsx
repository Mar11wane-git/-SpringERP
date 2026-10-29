import { useQuery } from '@tanstack/react-query'
import { ArrowLeftRight, Pencil } from 'lucide-react'
import { useParams } from 'react-router-dom'

import { DataTable } from '@/components/data-table/data-table'
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
import { formatDateTime, formatMoney, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Product, StockMovement } from '@/types/api'

import { movementColumns } from './movement-columns'
import { ProductFormDialog } from './product-form-dialog'
import { StockMovementDialog } from './stock-movement-dialog'

export default function ProductDetailPage() {
  const { id } = useParams()
  const { can } = useAuth()
  const currency = useCurrency()
  const { data: product, isLoading, error, refetch } = useQuery({
    queryKey: ['products', Number(id)],
    queryFn: () => api.get<Product>(`/api/products/${id}`),
  })
  const table = useTableState({}, { key: 'createdAt', direction: 'desc' }, 10)
  const movements = usePagedQuery<StockMovement>('stock-movements', `/api/products/${id}/stock-movements`, table.params)

  if (isLoading) return <Skeleton className="h-96" />
  if (error || !product) return <ErrorState error={error} onRetry={() => void refetch()} />

  const margin = Number(product.unitPrice) > 0 ? ((Number(product.unitPrice) - Number(product.costPrice)) / Number(product.unitPrice)) * 100 : null

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {product.name}
            <StatusBadge status={!product.active ? 'INACTIVE' : product.lowStock ? 'LOW_STOCK' : 'ACTIVE'} />
          </span>
        }
        description={`SKU ${product.sku}${product.category ? ` · ${product.category.name}` : ''}`}
        actions={
          <>
            {(can('INVENTORY_WRITE') || can('STOCK_ADJUST')) && product.active && (
              <StockMovementDialog
                product={product}
                trigger={
                  <Button variant="secondary">
                    <ArrowLeftRight />
                    Record movement
                  </Button>
                }
              />
            )}
            {can('INVENTORY_WRITE') && (
              <ProductFormDialog
                product={product}
                trigger={
                  <Button>
                    <Pencil />
                    Edit
                  </Button>
                }
              />
            )}
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">On hand</p>
          <p className={cn('mt-1 text-2xl font-semibold', product.lowStock && 'text-warning', product.quantityOnHand === 0 && 'text-destructive')}>
            {formatNumber(product.quantityOnHand)} <span className="text-sm font-normal text-muted-foreground">{product.unit}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Reorder at {formatNumber(product.reorderLevel)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Selling price (excl. tax)</p>
          <p className="mt-1 text-2xl font-semibold">{formatMoney(product.unitPrice, currency)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Tax {Number(product.taxRate)}%{margin !== null && ` · margin ${margin.toFixed(1)}%`}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Stock value at cost</p>
          <p className="mt-1 text-2xl font-semibold">{formatMoney(Number(product.costPrice) * product.quantityOnHand, currency)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Cost {formatMoney(product.costPrice, currency)} / {product.unit}</p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="Details" />
          <CardBody>
            <DefinitionList
              className="sm:grid-cols-1"
              items={[
                ['Category', product.category?.name ?? 'Uncategorized'],
                ['Preferred supplier', product.supplier?.name ?? '—'],
                ['Unit', product.unit],
                ['Last updated', formatDateTime(product.updatedAt)],
                ['Description', <span className="whitespace-pre-wrap">{product.description || '—'}</span>],
              ]}
            />
          </CardBody>
        </Card>
        <div className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold">Stock movement history</h2>
          <DataTable
            tableId="product-movements"
            columns={movementColumns(currency, false)}
            page={movements.data}
            isLoading={movements.isLoading}
            error={movements.error}
            onRetry={() => void movements.refetch()}
            sort={table.sort}
            onSort={table.toggleSort}
            onPageChange={table.setPage}
            pageSize={table.size}
            onPageSizeChange={table.setSize}
            rowKey={(m) => m.id}
            emptyTitle="No movements yet"
            emptyDescription="Receipts, issues, adjustments and sales will appear here."
          />
        </div>
      </div>
    </>
  )
}
