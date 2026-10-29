import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, CheckCircle2, FileText, PackageCheck, Pencil } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeader } from '@/components/layout/app-shell'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DefinitionList } from '@/components/ui/definition-list'
import { DocumentLines } from '@/components/ui/document-lines'
import { ErrorState, Skeleton } from '@/components/ui/feedback'
import { useAuth } from '@/features/auth/auth-context'
import { api } from '@/lib/api'
import { formatDate, formatDateTime } from '@/lib/format'
import { handleMutationError } from '@/lib/mutations'
import type { Invoice, Order } from '@/types/api'

export default function OrderDetailPage() {
  const { id } = useParams()
  const { can } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: order, isLoading, error, refetch } = useQuery({
    queryKey: ['sales-orders', Number(id)],
    queryFn: () => api.get<Order>(`/api/sales-orders/${id}`),
  })

  const refresh = () => {
    for (const key of ['sales-orders', 'products', 'invoices', 'dashboard', 'stock-movements']) {
      void queryClient.invalidateQueries({ queryKey: [key] })
    }
  }
  const action = useMutation({
    mutationFn: (verb: 'confirm' | 'complete' | 'cancel') => api.post<Order>(`/api/sales-orders/${id}/${verb}`),
    onSuccess: (o) => {
      refresh()
      toast.success(`${o.orderNumber} is now ${o.status.toLowerCase()}`)
    },
    onError: (e) => handleMutationError(e),
  })
  const invoice = useMutation({
    mutationFn: () => api.post<Invoice>('/api/invoices', { salesOrderId: Number(id) }),
    onSuccess: (inv) => {
      refresh()
      toast.success(`Invoice ${inv.invoiceNumber} issued`)
      navigate(`/invoices/${inv.id}`)
    },
    onError: (e) => handleMutationError(e),
  })

  if (isLoading) return <Skeleton className="h-96" />
  if (error || !order) return <ErrorState error={error} onRetry={() => void refetch()} />

  const canSell = can('SALES_WRITE')
  const invoiceable = (order.status === 'CONFIRMED' || order.status === 'COMPLETED') && !order.activeInvoiceId

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {order.orderNumber}
            <StatusBadge status={order.status} />
          </span>
        }
        description={
          <>
            <Link to={`/customers/${order.customer.id}`} className="hover:underline">
              {order.customer.name}
            </Link>{' '}
            · {formatDate(order.orderDate)}
          </>
        }
        actions={
          <>
            {canSell && order.status === 'DRAFT' && (
              <Button variant="secondary" asChild>
                <Link to={`/sales/orders/${order.id}/edit`}>
                  <Pencil />
                  Edit
                </Link>
              </Button>
            )}
            {canSell && (order.status === 'DRAFT' || (order.status === 'CONFIRMED' && !order.activeInvoiceId)) && (
              <ConfirmDialog
                title={`Cancel ${order.orderNumber}?`}
                description={order.status === 'CONFIRMED' ? 'The goods will be returned to stock.' : 'The quote will be closed.'}
                confirmLabel="Cancel order"
                destructive
                onConfirm={() => action.mutateAsync('cancel')}
                trigger={
                  <Button variant="secondary">
                    <Ban />
                    Cancel
                  </Button>
                }
              />
            )}
            {canSell && order.status === 'DRAFT' && (
              <ConfirmDialog
                title={`Confirm ${order.orderNumber}?`}
                description="Stock is deducted for every line. If any product lacks stock, nothing changes."
                confirmLabel="Confirm order"
                onConfirm={() => action.mutateAsync('confirm')}
                trigger={
                  <Button>
                    <CheckCircle2 />
                    Confirm order
                  </Button>
                }
              />
            )}
            {canSell && order.status === 'CONFIRMED' && (
              <ConfirmDialog
                title="Mark as delivered?"
                description="The order will be marked completed."
                confirmLabel="Mark completed"
                onConfirm={() => action.mutateAsync('complete')}
                trigger={
                  <Button variant="secondary">
                    <PackageCheck />
                    Mark delivered
                  </Button>
                }
              />
            )}
            {can('INVOICE_WRITE') && invoiceable && (
              <ConfirmDialog
                title="Issue invoice?"
                description="An invoice number is allocated and the lines are copied. Payment terms come from company settings."
                confirmLabel="Issue invoice"
                onConfirm={() => invoice.mutateAsync()}
                trigger={
                  <Button>
                    <FileText />
                    Create invoice
                  </Button>
                }
              />
            )}
            {order.activeInvoiceId && can('INVOICE_READ') && (
              <Button variant="secondary" asChild>
                <Link to={`/invoices/${order.activeInvoiceId}`}>
                  <FileText />
                  {order.activeInvoiceNumber}
                </Link>
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <Card>
          <CardHeader title="Lines" />
          <div className="border-t border-border">
            <DocumentLines
              currency={order.currency}
              lines={order.lines.map((l) => ({
                key: l.id,
                lineNo: l.lineNo,
                description: (
                  <Link to={`/inventory/products/${l.product.id}`} className="hover:underline">
                    <span className="block">{l.description}</span>
                    <span className="block text-xs text-muted-foreground">{l.sku}</span>
                  </Link>
                ),
                quantity: l.quantity,
                unitPrice: l.unitPrice,
                discountPercent: l.discountPercent,
                taxRate: l.taxRate,
                lineSubtotal: l.lineSubtotal,
              }))}
              totals={[
                ['Subtotal', order.subtotal, 'normal'],
                ['Discount', -order.discountTotal, 'normal'],
                ['Tax', order.taxTotal, 'normal'],
                ['Total', order.total, 'strong'],
              ]}
            />
          </div>
        </Card>
        <Card className="h-fit">
          <CardHeader title="Timeline" />
          <CardBody>
            <DefinitionList
              className="sm:grid-cols-1"
              items={[
                ['Created', `${formatDateTime(order.createdAt)}${order.createdBy ? ` by ${order.createdBy}` : ''}`],
                ['Confirmed', order.confirmedAt ? formatDateTime(order.confirmedAt) : '—'],
                ['Completed', order.completedAt ? formatDateTime(order.completedAt) : '—'],
                ...(order.cancelledAt ? ([['Cancelled', formatDateTime(order.cancelledAt)]] as [string, string][]) : []),
                ['Notes', order.notes ? <span className="whitespace-pre-wrap">{order.notes}</span> : '—'],
              ]}
            />
          </CardBody>
        </Card>
      </div>
    </>
  )
}
