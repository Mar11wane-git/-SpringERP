import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { FormField } from '@/components/ui/form-field'
import { Input, Select } from '@/components/ui/input'
import { useAuth } from '@/features/auth/auth-context'
import { useOptions } from '@/hooks/use-paged-query'
import { api } from '@/lib/api'
import { handleMutationError } from '@/lib/mutations'
import type { Partner, Product, StockMovement } from '@/types/api'

const schema = z
  .object({
    type: z.enum(['RECEIPT', 'ISSUE', 'ADJUSTMENT']),
    quantity: z.string().trim().regex(/^-?\d{1,7}$/, 'Enter a whole number'),
    unitCost: z.union([z.literal(''), z.string().trim().regex(/^\d{1,15}(\.\d{1,2})?$/, 'Invalid amount')]),
    supplierId: z.string(),
    reference: z.string().max(60),
    note: z.string().max(255),
  })
  .superRefine((v, ctx) => {
    const q = Number(v.quantity)
    if (v.type !== 'ADJUSTMENT' && q <= 0) ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'Must be greater than zero' })
    if (v.type === 'ADJUSTMENT' && q === 0) ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'An adjustment must change the quantity' })
  })

type Values = z.infer<typeof schema>

const DESCRIPTIONS: Record<Values['type'], string> = {
  RECEIPT: 'Goods received from a supplier. Adds to stock.',
  ISSUE: 'Goods taken out for internal use, loss or damage. Removes from stock.',
  ADJUSTMENT: 'Correction after a physical count. Use a negative number to reduce stock.',
}

export function StockMovementDialog({ product, trigger }: { product: Product; trigger: ReactNode }) {
  const { can } = useAuth()
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const allowedTypes = (['RECEIPT', 'ISSUE', 'ADJUSTMENT'] as const).filter((t) =>
    t === 'RECEIPT' ? can('INVENTORY_WRITE') : can('STOCK_ADJUST'),
  )
  const defaults: Values = {
    type: allowedTypes[0] ?? 'RECEIPT',
    quantity: '',
    unitCost: Number(product.costPrice).toFixed(2),
    supplierId: product.supplier ? String(product.supplier.id) : '',
    reference: '',
    note: '',
  }
  const { register, handleSubmit, reset, setError, control, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  })
  const type = useWatch({ control, name: 'type' })
  const { data: suppliers = [] } = useOptions<Partner>('suppliers', '/api/suppliers', { active: true }, open && type === 'RECEIPT')

  useEffect(() => {
    if (open) reset(defaults)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const mutation = useMutation({
    mutationFn: (v: Values) =>
      api.post<StockMovement>(`/api/products/${product.id}/stock-movements`, {
        type: v.type,
        quantity: Number(v.quantity),
        unitCost: v.type === 'RECEIPT' && v.unitCost ? v.unitCost : null,
        supplierId: v.type === 'RECEIPT' && v.supplierId ? Number(v.supplierId) : null,
        reference: v.reference || null,
        note: v.note || null,
      }),
    onSuccess: (m) => {
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      void queryClient.invalidateQueries({ queryKey: ['stock-movements'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success(`Stock updated: ${m.quantityAfter} ${product.unit} on hand`)
      setOpen(false)
    },
  })

  if (allowedTypes.length === 0) return null

  return (
    <Dialog open={open} onOpenChange={(o) => !formState.isSubmitting && setOpen(o)}>
      <span className="contents" onClick={() => setOpen(true)}>
        {trigger}
      </span>
      <DialogContent
        title="Record stock movement"
        description={`${product.sku} · ${product.quantityOnHand} ${product.unit} on hand`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={formState.isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" form="movement-form" loading={formState.isSubmitting}>
              Record movement
            </Button>
          </>
        }
      >
        <form
          id="movement-form"
          noValidate
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={handleSubmit(async (v) => {
            try {
              await mutation.mutateAsync(v)
            } catch (e) {
              handleMutationError(e, setError)
            }
          })}
        >
          <FormField label="Movement type" hint={DESCRIPTIONS[type]} className="sm:col-span-2" required>
            <Select {...register('type')}>
              {allowedTypes.map((t) => (
                <option key={t} value={t}>
                  {t === 'RECEIPT' ? 'Receipt' : t === 'ISSUE' ? 'Issue' : 'Adjustment'}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label={`Quantity (${product.unit})`} error={formState.errors.quantity?.message} required>
            <Input inputMode="numeric" autoFocus {...register('quantity')} />
          </FormField>
          {type === 'RECEIPT' && (
            <FormField label="Unit cost" error={formState.errors.unitCost?.message} hint="Used for purchase reporting">
              <Input inputMode="decimal" {...register('unitCost')} />
            </FormField>
          )}
          {type === 'RECEIPT' && (
            <FormField label="Supplier" className="sm:col-span-2">
              <Select {...register('supplierId')}>
                <option value="">Not specified</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </FormField>
          )}
          <FormField label="Reference" error={formState.errors.reference?.message} hint="Delivery note, count sheet…">
            <Input {...register('reference')} />
          </FormField>
          <FormField label="Note" error={formState.errors.note?.message}>
            <Input {...register('note')} />
          </FormField>
        </form>
      </DialogContent>
    </Dialog>
  )
}
