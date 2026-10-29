import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { FormField } from '@/components/ui/form-field'
import { Input, Select } from '@/components/ui/input'
import { api } from '@/lib/api'
import { formatMoney, humanize, isoDate } from '@/lib/format'
import { handleMutationError } from '@/lib/mutations'
import { PAYMENT_METHODS, type Invoice } from '@/types/api'

import { toHundredths } from '../orders/pricing'

export function PaymentDialog({ invoice, trigger }: { invoice: Invoice; trigger: ReactNode }) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const balanceCents = Math.round(Number(invoice.balanceDue) * 100)
  const today = isoDate(new Date())

  const schema = z.object({
    amount: z
      .string()
      .trim()
      .regex(/^\d{1,15}(\.\d{1,2})?$/, 'Enter an amount with up to 2 decimals')
      .refine((v) => toHundredths(v) > 0, 'Must be greater than zero')
      .refine((v) => toHundredths(v) <= balanceCents, `Cannot exceed the balance due (${formatMoney(invoice.balanceDue, invoice.currency)})`),
    paymentDate: z
      .string()
      .min(1, 'Required')
      .refine((d) => d <= today, 'Cannot be in the future')
      .refine((d) => d >= invoice.issueDate, 'Cannot precede the invoice date'),
    method: z.enum(PAYMENT_METHODS),
    reference: z.string().max(100),
    note: z.string().max(255),
  })
  type Values = z.infer<typeof schema>

  const { register, handleSubmit, reset, setError, formState } = useForm<Values>({ resolver: zodResolver(schema) })
  useEffect(() => {
    if (open) {
      reset({ amount: Number(invoice.balanceDue).toFixed(2), paymentDate: today, method: 'BANK_TRANSFER', reference: '', note: '' })
    }
  }, [open, invoice.balanceDue, reset, today])

  const submit = async (v: Values) => {
    try {
      const updated = await api.post<Invoice>(`/api/invoices/${invoice.id}/payments`, {
        ...v,
        reference: v.reference || null,
        note: v.note || null,
      })
      queryClient.setQueryData(['invoices', invoice.id], updated)
      for (const key of ['invoices', 'dashboard', 'notifications']) void queryClient.invalidateQueries({ queryKey: [key] })
      toast.success(updated.status === 'PAID' ? `${invoice.invoiceNumber} is fully paid` : 'Payment recorded')
      setOpen(false)
    } catch (e) {
      handleMutationError(e, setError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !formState.isSubmitting && setOpen(o)}>
      <span className="contents" onClick={() => setOpen(true)}>
        {trigger}
      </span>
      <DialogContent
        title="Record a payment"
        description={`${invoice.invoiceNumber} · balance due ${formatMoney(invoice.balanceDue, invoice.currency)}. Record money already received; no payment is processed here.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={formState.isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" form="payment-form" loading={formState.isSubmitting}>
              Record payment
            </Button>
          </>
        }
      >
        <form id="payment-form" onSubmit={handleSubmit(submit)} noValidate className="grid gap-4 sm:grid-cols-2">
          <FormField label={`Amount (${invoice.currency})`} error={formState.errors.amount?.message} required>
            <Input inputMode="decimal" autoFocus {...register('amount')} />
          </FormField>
          <FormField label="Payment date" error={formState.errors.paymentDate?.message} required>
            <Input type="date" max={today} min={invoice.issueDate} {...register('paymentDate')} />
          </FormField>
          <FormField label="Method" error={formState.errors.method?.message} required>
            <Select {...register('method')}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {humanize(m)}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Reference" error={formState.errors.reference?.message} hint="Bank transaction or check number">
            <Input {...register('reference')} />
          </FormField>
          <FormField label="Note" error={formState.errors.note?.message} className="sm:col-span-2">
            <Input {...register('note')} />
          </FormField>
        </form>
      </DialogContent>
    </Dialog>
  )
}
