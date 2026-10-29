import { Link } from 'react-router-dom'

import type { Column } from '@/components/data-table/data-table'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { formatDateTime, formatMoney, formatNumber, humanize } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { MovementType, StockMovement } from '@/types/api'

const TONES: Record<MovementType, BadgeTone> = {
  RECEIPT: 'success',
  ISSUE: 'warning',
  ADJUSTMENT: 'neutral',
  SALE: 'info',
  SALE_REVERSAL: 'neutral',
}

export function movementColumns(currency: string, withProduct: boolean): Column<StockMovement>[] {
  const cols: Column<StockMovement>[] = [
    { id: 'date', header: 'Date', sortKey: 'createdAt', pinned: true, cell: (m) => <span className="whitespace-nowrap">{formatDateTime(m.createdAt)}</span> },
  ]
  if (withProduct) {
    cols.push({
      id: 'product',
      header: 'Product',
      cell: (m) => (
        <Link to={`/inventory/products/${m.product.id}`} className="hover:underline">
          <span className="block font-medium">{m.product.name}</span>
          <span className="block text-xs text-muted-foreground">{m.sku}</span>
        </Link>
      ),
    })
  }
  cols.push(
    { id: 'type', header: 'Type', cell: (m) => <Badge tone={TONES[m.type]}>{humanize(m.type)}</Badge> },
    {
      id: 'quantity',
      header: 'Change',
      sortKey: 'quantity',
      align: 'right',
      cell: (m) => (
        <span className={cn('font-medium', m.quantity > 0 ? 'text-success' : 'text-foreground')}>
          {m.quantity > 0 ? '+' : '−'}
          {formatNumber(Math.abs(m.quantity))}
        </span>
      ),
    },
    { id: 'after', header: 'Balance', align: 'right', cell: (m) => formatNumber(m.quantityAfter) },
    { id: 'cost', header: 'Unit cost', align: 'right', defaultHidden: !withProduct, cell: (m) => (m.unitCost === null ? '—' : formatMoney(m.unitCost, currency)) },
    {
      id: 'reference',
      header: 'Reference',
      cell: (m) =>
        m.salesOrderId ? (
          <Link to={`/sales/orders/${m.salesOrderId}`} className="text-primary hover:underline">
            {m.reference}
          </Link>
        ) : (
          (m.reference ?? '—')
        ),
    },
    { id: 'supplier', header: 'Supplier', defaultHidden: true, cell: (m) => m.supplier?.name ?? '—' },
    { id: 'note', header: 'Note', defaultHidden: true, cell: (m) => m.note ?? '—' },
    { id: 'by', header: 'By', cell: (m) => <span className="text-muted-foreground">{m.createdBy ?? '—'}</span> },
  )
  return cols
}
