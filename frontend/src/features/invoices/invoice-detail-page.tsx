import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Ban, Banknote, Download, Printer } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeader } from '@/components/layout/app-shell'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DocumentLines } from '@/components/ui/document-lines'
import { ErrorState, Skeleton } from '@/components/ui/feedback'
import { useAuth } from '@/features/auth/auth-context'
import { api } from '@/lib/api'
import { formatDate, formatMoney, humanize } from '@/lib/format'
import { handleMutationError } from '@/lib/mutations'
import type { Invoice } from '@/types/api'

import { PaymentDialog } from './payment-dialog'

export default function InvoiceDetailPage() {
  const { id } = useParams()
  const { can } = useAuth()
  const queryClient = useQueryClient()
  const { data: invoice, isLoading, error, refetch } = useQuery({
    queryKey: ['invoices', Number(id)],
    queryFn: () => api.get<Invoice>(`/api/invoices/${id}`),
  })
  const cancel = useMutation({
    mutationFn: () => api.post<Invoice>(`/api/invoices/${id}/cancel`),
    onSuccess: (inv) => {
      queryClient.setQueryData(['invoices', inv.id], inv)
      void queryClient.invalidateQueries({ queryKey: ['invoices'] })
      void queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
      toast.success(`${inv.invoiceNumber} cancelled`)
    },
    onError: (e) => handleMutationError(e),
  })
  const pdf = useMutation({
    mutationFn: (mode: 'open' | 'save') => api.download(`/api/invoices/${id}/pdf`, undefined, mode),
    onError: (e) => handleMutationError(e),
  })

  if (isLoading) return <Skeleton className="h-96" />
  if (error || !invoice) return <ErrorState error={error} onRetry={() => void refetch()} />

  const open = invoice.status === 'ISSUED' || invoice.status === 'PARTIALLY_PAID'

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {invoice.invoiceNumber}
            <StatusBadge status={invoice.overdue ? 'OVERDUE' : invoice.status} />
          </span>
        }
        description={
          <>
            {invoice.billToName} · order{' '}
            <Link to={`/sales/orders/${invoice.salesOrder.id}`} className="hover:underline">
              {invoice.salesOrder.name}
            </Link>
          </>
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => pdf.mutate('open')} loading={pdf.isPending && pdf.variables === 'open'}>
              <Printer />
              View PDF
            </Button>
            <Button variant="secondary" onClick={() => pdf.mutate('save')} loading={pdf.isPending && pdf.variables === 'save'}>
              <Download />
              Download
            </Button>
            {can('INVOICE_WRITE') && invoice.status === 'ISSUED' && Number(invoice.amountPaid) === 0 && (
              <ConfirmDialog
                title={`Cancel ${invoice.invoiceNumber}?`}
                description="The invoice number stays reserved; the order can then be re-invoiced or cancelled."
                confirmLabel="Cancel invoice"
                destructive
                onConfirm={() => cancel.mutateAsync()}
                trigger={
                  <Button variant="secondary">
                    <Ban />
                    Cancel
                  </Button>
                }
              />
            )}
            {can('PAYMENT_WRITE') && open && (
              <PaymentDialog
                invoice={invoice}
                trigger={
                  <Button>
                    <Banknote />
                    Record payment
                  </Button>
                }
              />
            )}
          </>
        }
      />

      {invoice.overdue && (
        <div role="alert" className="mb-6 flex items-center gap-2 rounded-md border border-destructive/30 bg-danger-soft px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="size-4" aria-hidden />
          Payment was due on {formatDate(invoice.dueDate)}. {formatMoney(invoice.balanceDue, invoice.currency)} is outstanding.
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <Card>
          <div className="grid gap-6 border-b border-border px-5 py-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Bill to</p>
              <p className="mt-0.5 text-sm font-medium">{invoice.billToName}</p>
              {invoice.billToAddress && <p className="text-xs text-muted-foreground">{invoice.billToAddress}</p>}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Issued</p>
              <p className="mt-0.5 text-sm">{formatDate(invoice.issueDate)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Due</p>
              <p className="mt-0.5 text-sm">{formatDate(invoice.dueDate)}</p>
            </div>
          </div>
          <DocumentLines
            currency={invoice.currency}
            lines={invoice.lines.map((l) => ({ ...l, key: l.lineNo, description: l.description }))}
            totals={[
              ['Subtotal', invoice.subtotal, 'normal'],
              ['Discount', -invoice.discountTotal, 'normal'],
              ['Tax', invoice.taxTotal, 'normal'],
              ['Total', invoice.total, 'strong'],
              ['Paid', -invoice.amountPaid, 'normal'],
              ['Balance due', invoice.balanceDue, 'accent'],
            ]}
          />
          {invoice.notes && <p className="border-t border-border px-5 py-4 text-sm whitespace-pre-wrap text-muted-foreground">{invoice.notes}</p>}
        </Card>

        <Card className="h-fit">
          <CardHeader title="Payments" description="Recorded manually by accounting" />
          <CardBody>
            {invoice.payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payment recorded yet.</p>
            ) : (
              <ul className="space-y-3">
                {invoice.payments.map((p) => (
                  <li key={p.id} className="flex items-start justify-between gap-3 text-sm">
                    <div>
                      <p className="font-medium">{formatDate(p.paymentDate)}</p>
                      <p className="text-xs text-muted-foreground">
                        {humanize(p.method)}
                        {p.reference && ` · ${p.reference}`}
                      </p>
                      {p.recordedBy && <p className="text-xs text-subtle-foreground">by {p.recordedBy}</p>}
                    </div>
                    <span className="font-medium tabular">{formatMoney(p.amount, invoice.currency)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  )
}
