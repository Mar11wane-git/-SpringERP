import { useMutation, useQuery } from '@tanstack/react-query'
import { Download, Plus } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { DataTable, FilterSelect, SearchInput, type Column } from '@/components/data-table/data-table'
import { PageHeader } from '@/components/layout/app-shell'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-context'
import { useCurrency } from '@/hooks/use-company'
import { usePagedQuery } from '@/hooks/use-paged-query'
import { useTableState } from '@/hooks/use-table-state'
import { api, errorMessage } from '@/lib/api'
import { formatMoney, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Category, Product } from '@/types/api'

import { ProductFormDialog } from './product-form-dialog'

export default function ProductsPage() {
  const { can } = useAuth()
  const currency = useCurrency()
  const [searchParams] = useSearchParams()
  const table = useTableState(
    { categoryId: '', lowStock: searchParams.get('lowStock') === 'true' ? 'true' : '', active: 'true' },
    { key: 'name', direction: 'asc' },
  )
  const query = usePagedQuery<Product>('products', '/api/products', table.params)
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => api.get<Category[]>('/api/categories') })

  const exportCsv = useMutation({
    mutationFn: () => api.download('/api/products/export', { ...table.params, page: undefined, size: undefined }),
    onError: (e) => toast.error(errorMessage(e)),
  })

  const columns: Column<Product>[] = [
    {
      id: 'product',
      header: 'Product',
      sortKey: 'name',
      pinned: true,
      cell: (p) => (
        <Link to={`/inventory/products/${p.id}`} className="block min-w-0 hover:underline">
          <span className="block truncate font-medium">{p.name}</span>
          <span className="block text-xs text-muted-foreground">{p.sku}</span>
        </Link>
      ),
    },
    { id: 'category', header: 'Category', cell: (p) => p.category?.name ?? <span className="text-muted-foreground">—</span> },
    { id: 'supplier', header: 'Supplier', defaultHidden: true, cell: (p) => p.supplier?.name ?? '—' },
    { id: 'price', header: 'Price', sortKey: 'unitPrice', align: 'right', cell: (p) => formatMoney(p.unitPrice, currency) },
    { id: 'cost', header: 'Cost', align: 'right', defaultHidden: true, cell: (p) => formatMoney(p.costPrice, currency) },
    {
      id: 'stock',
      header: 'On hand',
      sortKey: 'quantityOnHand',
      align: 'right',
      cell: (p) => (
        <span className={cn('font-medium', p.lowStock && (p.quantityOnHand === 0 ? 'text-destructive' : 'text-warning'))}>
          {formatNumber(p.quantityOnHand)} <span className="font-normal text-muted-foreground">{p.unit}</span>
        </span>
      ),
    },
    { id: 'reorder', header: 'Reorder at', sortKey: 'reorderLevel', align: 'right', cell: (p) => formatNumber(p.reorderLevel) },
    {
      id: 'status',
      header: 'Status',
      cell: (p) => <StatusBadge status={!p.active ? 'INACTIVE' : p.lowStock ? 'LOW_STOCK' : 'ACTIVE'} />,
    },
  ]

  return (
    <>
      <PageHeader
        title="Products"
        description="Catalog, prices and stock levels."
        actions={
          <>
            {can('REPORT_READ') && (
              <Button variant="secondary" onClick={() => exportCsv.mutate()} loading={exportCsv.isPending}>
                <Download />
                Export CSV
              </Button>
            )}
            {can('INVENTORY_WRITE') && (
              <ProductFormDialog
                trigger={
                  <Button>
                    <Plus />
                    New product
                  </Button>
                }
              />
            )}
          </>
        }
      />
      <DataTable
        tableId="products"
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
        rowHref={(p) => `/inventory/products/${p.id}`}
        emptyTitle="No products match"
        emptyDescription="Try another search or filter, or create a product."
        toolbar={
          <>
            <SearchInput value={table.search} onChange={table.setSearch} placeholder="Search name or SKU" />
            <FilterSelect
              label="Category"
              value={String(table.filters.categoryId)}
              onChange={(v) => table.setFilter('categoryId', v)}
              options={categories.map((c) => ({ value: String(c.id), label: c.name }))}
            />
            <FilterSelect
              label="Status"
              value={String(table.filters.active)}
              onChange={(v) => table.setFilter('active', v)}
              options={[
                { value: 'true', label: 'Active' },
                { value: 'false', label: 'Archived' },
              ]}
            />
            <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <input
                type="checkbox"
                className="size-4 accent-[var(--primary)]"
                checked={table.filters.lowStock === 'true'}
                onChange={(e) => table.setFilter('lowStock', e.target.checked ? 'true' : '')}
              />
              Low stock only
            </label>
          </>
        }
      />
    </>
  )
}
