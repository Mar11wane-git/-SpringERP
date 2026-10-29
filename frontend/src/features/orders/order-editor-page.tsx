import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'

import { PageHeader } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { ErrorState, Skeleton } from '@/components/ui/feedback'
import { FormField } from '@/components/ui/form-field'
import { Input, Select, Textarea } from '@/components/ui/input'
import { useCurrency } from '@/hooks/use-company'
import { useOptions } from '@/hooks/use-paged-query'
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes'
import { api } from '@/lib/api'
import { formatMoney, isoDate } from '@/lib/format'
import { handleMutationError } from '@/lib/mutations'
import type { Order, Partner, Product } from '@/types/api'

import { centsToNumber, previewLine, previewTotals } from './pricing'
import { ProductPicker } from './product-picker'

const lineSchema = z.object({
  product: z.custom<Product>((v) => !!v && typeof v === 'object', 'Choose a product'),
  quantity: z.string().trim().regex(/^[1-9]\d{0,5}$/, 'Whole number ≥ 1'),
  unitPrice: z.string().trim().regex(/^\d{1,15}(\.\d{1,2})?$/, 'Invalid price'),
  discountPercent: z
    .string()
    .trim()
    .regex(/^\d{1,3}(\.\d{1,2})?$/, 'Invalid %')
    .refine((v) => Number(v) <= 100, '≤ 100'),
})

const schema = z
  .object({
    customerId: z.string().min(1, 'Choose a customer'),
    orderDate: z.string().min(1, 'Date is required'),
    notes: z.string().max(1000),
    lines: z.array(lineSchema).min(1, 'Add at least one line').max(200),
  })
  .superRefine((v, ctx) => {
    const seen = new Set<number>()
    v.lines.forEach((l, i) => {
      if (l.product && seen.has(l.product.id)) {
        ctx.addIssue({ code: 'custom', path: ['lines', i, 'product'], message: 'Already on this order' })
      }
      if (l.product) seen.add(l.product.id)
    })
  })

type Values = z.infer<typeof schema>
type LineValues = Values['lines'][number]

const emptyLine = (): LineValues => ({ product: null as unknown as Product, quantity: '1', unitPrice: '', discountPercent: '0' })

function fromOrder(o: Order): Values {
  return {
    customerId: String(o.customer.id),
    orderDate: o.orderDate,
    notes: o.notes ?? '',
    lines: o.lines.map((l) => ({
      // The picker only needs identity, name, sku and tax rate to render and preview.
      product: { id: l.product.id, name: l.product.name, sku: l.sku, taxRate: l.taxRate } as Product,
      quantity: String(l.quantity),
      unitPrice: Number(l.unitPrice).toFixed(2),
      discountPercent: String(Number(l.discountPercent)),
    })),
  }
}

export default function OrderEditorPage() {
  const { id } = useParams()
  const editing = Boolean(id)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const currency = useCurrency()
  const [saving, setSaving] = useState(false)

  const existing = useQuery({ queryKey: ['sales-orders', Number(id)], queryFn: () => api.get<Order>(`/api/sales-orders/${id}`), enabled: editing })
  const { data: customers = [] } = useOptions<Partner>('customers', '/api/customers', { active: true })

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { customerId: searchParams.get('customerId') ?? '', orderDate: isoDate(new Date()), notes: '', lines: [emptyLine()] },
  })
  const { register, handleSubmit, control, reset, setError, formState } = form
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' })
  const lines = useWatch({ control, name: 'lines' })

  useEffect(() => {
    if (existing.data) reset(fromOrder(existing.data))
  }, [existing.data, reset])

  const { allowNavigation } = useUnsavedChanges(formState.isDirty)

  const previews = (lines ?? []).map((l) => (l?.product ? previewLine(Number(l.quantity), l.unitPrice || '0', l.discountPercent, Number(l.product.taxRate)) : null))
  const totals = previewTotals(previews.filter((p): p is NonNullable<typeof p> => p !== null))

  const onSubmit = async (v: Values) => {
    setSaving(true)
    const body = {
      customerId: Number(v.customerId),
      orderDate: v.orderDate,
      notes: v.notes || null,
      lines: v.lines.map((l) => ({
        productId: l.product.id,
        quantity: Number(l.quantity),
        unitPrice: l.unitPrice,
        discountPercent: l.discountPercent,
      })),
      version: existing.data?.version ?? null,
    }
    try {
      const saved = editing ? await api.put<Order>(`/api/sales-orders/${id}`, body) : await api.post<Order>('/api/sales-orders', body)
      allowNavigation()
      void queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
      toast.success(`${saved.orderNumber} saved as draft`)
      navigate(`/sales/orders/${saved.id}`, { replace: true })
    } catch (e) {
      handleMutationError(e, setError)
    } finally {
      setSaving(false)
    }
  }

  if (editing && existing.isLoading) return <Skeleton className="h-96" />
  if (editing && existing.error) return <ErrorState error={existing.error} onRetry={() => void existing.refetch()} />
  if (editing && existing.data && existing.data.status !== 'DRAFT') {
    return <ErrorState error={new Error('Only draft orders can be edited.')} />
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <PageHeader
        title={editing ? `Edit ${existing.data?.orderNumber ?? ''}` : 'New quote'}
        description="Drafts can be changed freely. Confirming the order takes the goods out of stock."
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate(-1)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Save draft
            </Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Customer" />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <FormField label="Customer" error={formState.errors.customerId?.message} required>
                <Select {...register('customerId')}>
                  <option value="">Choose a customer…</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Order date" error={formState.errors.orderDate?.message} required>
                <Input type="date" {...register('orderDate')} />
              </FormField>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Lines"
              description="Prices default to the product's current price and can be adjusted."
              action={
                <Button variant="secondary" size="sm" onClick={() => append(emptyLine())}>
                  <Plus />
                  Add line
                </Button>
              }
            />
            <div className="overflow-x-auto border-t border-border">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-xs text-muted-foreground">
                    <th scope="col" className="h-9 px-3 text-left font-medium">Product</th>
                    <th scope="col" className="w-24 px-2 text-left font-medium">Qty</th>
                    <th scope="col" className="w-32 px-2 text-left font-medium">Unit price</th>
                    <th scope="col" className="w-24 px-2 text-left font-medium">Disc. %</th>
                    <th scope="col" className="w-32 px-3 text-right font-medium">Net</th>
                    <th scope="col" className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {fields.map((field, i) => {
                    const err = formState.errors.lines?.[i]
                    const preview = previews[i]
                    return (
                      <tr key={field.id} className="border-b border-border align-top last:border-0">
                        <td className="px-3 py-2">
                          <Controller
                            control={control}
                            name={`lines.${i}.product`}
                            render={({ field: f }) => (
                              <ProductPicker
                                label={`Product for line ${i + 1}`}
                                value={f.value ?? null}
                                currency={currency}
                                invalid={!!err?.product}
                                onChange={(p) => {
                                  f.onChange(p)
                                  form.setValue(`lines.${i}.unitPrice`, Number(p.unitPrice).toFixed(2), { shouldDirty: true })
                                }}
                              />
                            )}
                          />
                          {err?.product && <p className="mt-1 text-xs text-destructive">{err.product.message}</p>}
                          {lines?.[i]?.product && Number(lines[i]?.quantity) > (lines[i]?.product.quantityOnHand ?? Infinity) && (
                            <p className="mt-1 text-xs text-warning">Only {lines[i]?.product.quantityOnHand} in stock; confirmation will fail.</p>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          <Input inputMode="numeric" aria-label={`Quantity line ${i + 1}`} aria-invalid={!!err?.quantity || undefined} {...register(`lines.${i}.quantity`)} />
                          {err?.quantity && <p className="mt-1 text-xs text-destructive">{err.quantity.message}</p>}
                        </td>
                        <td className="px-2 py-2">
                          <Input inputMode="decimal" aria-label={`Unit price line ${i + 1}`} aria-invalid={!!err?.unitPrice || undefined} {...register(`lines.${i}.unitPrice`)} />
                          {err?.unitPrice && <p className="mt-1 text-xs text-destructive">{err.unitPrice.message}</p>}
                        </td>
                        <td className="px-2 py-2">
                          <Input inputMode="decimal" aria-label={`Discount line ${i + 1}`} aria-invalid={!!err?.discountPercent || undefined} {...register(`lines.${i}.discountPercent`)} />
                          {err?.discountPercent && <p className="mt-1 text-xs text-destructive">{err.discountPercent.message}</p>}
                        </td>
                        <td className="px-3 py-2 text-right tabular">
                          <span className="inline-block pt-2">{preview ? formatMoney(centsToNumber(preview.net), currency) : '—'}</span>
                        </td>
                        <td className="py-2 pr-2">
                          <Button variant="ghost" size="icon-sm" aria-label={`Remove line ${i + 1}`} onClick={() => remove(i)} disabled={fields.length === 1}>
                            <Trash2 />
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {formState.errors.lines?.root && <p className="px-5 py-2 text-xs text-destructive">{formState.errors.lines.root.message}</p>}
          </Card>

          <Card>
            <CardHeader title="Notes" />
            <CardBody>
              <FormField label="Internal notes" error={formState.errors.notes?.message}>
                <Textarea rows={3} {...register('notes')} />
              </FormField>
            </CardBody>
          </Card>
        </div>

        <Card className="h-fit xl:sticky xl:top-20">
          <CardHeader title="Summary" description="Estimate; final amounts are calculated by the server." />
          <CardBody>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="tabular">{formatMoney(centsToNumber(totals.subtotal), currency)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Discount</dt><dd className="tabular">−{formatMoney(centsToNumber(totals.discount), currency)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Tax</dt><dd className="tabular">{formatMoney(centsToNumber(totals.tax), currency)}</dd></div>
              <div className="flex justify-between border-t border-border pt-2 text-base font-semibold"><dt>Total</dt><dd className="tabular">{formatMoney(centsToNumber(totals.total), currency)}</dd></div>
            </dl>
          </CardBody>
        </Card>
      </div>
    </form>
  )
}
