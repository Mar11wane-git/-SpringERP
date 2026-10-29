import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { FormField } from '@/components/ui/form-field'
import { Input, Select, Textarea } from '@/components/ui/input'
import { useOptions } from '@/hooks/use-paged-query'
import { api } from '@/lib/api'
import { handleMutationError } from '@/lib/mutations'
import type { Category, Partner, Product } from '@/types/api'

const money = z.string().trim().regex(/^\d{1,15}(\.\d{1,2})?$/, 'Use a positive amount with up to 2 decimals')
const percent = z
  .string()
  .trim()
  .regex(/^\d{1,3}(\.\d{1,2})?$/, 'Enter a percentage')
  .refine((v) => Number(v) <= 100, 'Must be 100 or less')
const wholeNumber = z.string().trim().regex(/^\d{1,7}$/, 'Enter a whole number')

// Mirrors InventoryDtos.ProductRequest validation on the server.
const schema = z.object({
  sku: z.string().trim().min(1, 'SKU is required').max(40).regex(/^[A-Za-z0-9._-]+$/, "Letters, digits, '.', '-' and '_' only"),
  name: z.string().trim().min(1, 'Name is required').max(150),
  description: z.string().max(1000),
  categoryId: z.string(),
  supplierId: z.string(),
  unit: z.string().trim().min(1, 'Unit is required').max(20),
  unitPrice: money,
  costPrice: money,
  taxRate: percent,
  reorderLevel: wholeNumber,
  initialQuantity: z.union([wholeNumber, z.literal('')]),
  active: z.boolean(),
})

type Values = z.infer<typeof schema>

function toValues(p?: Product, defaultTax = '20'): Values {
  return {
    sku: p?.sku ?? '',
    name: p?.name ?? '',
    description: p?.description ?? '',
    categoryId: p?.category ? String(p.category.id) : '',
    supplierId: p?.supplier ? String(p.supplier.id) : '',
    unit: p?.unit ?? 'pcs',
    unitPrice: p ? Number(p.unitPrice).toFixed(2) : '',
    costPrice: p ? Number(p.costPrice).toFixed(2) : '',
    taxRate: p ? String(Number(p.taxRate)) : defaultTax,
    reorderLevel: p ? String(p.reorderLevel) : '0',
    initialQuantity: '',
    active: p?.active ?? true,
  }
}

export function ProductFormDialog({ product, trigger }: { product?: Product; trigger: ReactNode }) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<Category[]>('/api/categories'),
    enabled: open,
  })
  const { data: suppliers = [] } = useOptions<Partner>('suppliers', '/api/suppliers', { active: true }, open)
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toValues(product) })
  const { register, handleSubmit, reset, setError, formState } = form
  const { errors, isSubmitting, isDirty } = formState

  useEffect(() => {
    if (open) reset(toValues(product))
  }, [open, product, reset])

  const mutation = useMutation({
    mutationFn: (v: Values) => {
      const body = {
        sku: v.sku,
        name: v.name,
        description: v.description || null,
        categoryId: v.categoryId ? Number(v.categoryId) : null,
        supplierId: v.supplierId ? Number(v.supplierId) : null,
        unit: v.unit,
        unitPrice: v.unitPrice,
        costPrice: v.costPrice,
        taxRate: v.taxRate,
        reorderLevel: Number(v.reorderLevel),
        initialQuantity: !product && v.initialQuantity ? Number(v.initialQuantity) : null,
        active: v.active,
        version: product?.version ?? null,
      }
      return product ? api.put<Product>(`/api/products/${product.id}`, body) : api.post<Product>('/api/products', body)
    },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      void queryClient.invalidateQueries({ queryKey: ['categories'] })
      toast.success(product ? `${saved.sku} updated` : `${saved.sku} created`)
      setOpen(false)
    },
  })

  const onSubmit = async (v: Values) => {
    try {
      await mutation.mutateAsync(v)
    } catch (e) {
      handleMutationError(e, setError)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && isDirty && !isSubmitting && !window.confirm('Discard unsaved changes?')) return
        setOpen(o)
      }}
    >
      <span className="contents" onClick={() => setOpen(true)}>
        {trigger}
      </span>
      <DialogContent
        title={product ? `Edit ${product.sku}` : 'New product'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" form="product-form" loading={isSubmitting}>
              {product ? 'Save changes' : 'Create product'}
            </Button>
          </>
        }
      >
        <form id="product-form" onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4 sm:grid-cols-2">
          <FormField label="SKU" error={errors.sku?.message} required>
            <Input {...register('sku')} autoComplete="off" className="uppercase" />
          </FormField>
          <FormField label="Name" error={errors.name?.message} required>
            <Input {...register('name')} />
          </FormField>
          <FormField label="Category" error={errors.categoryId?.message}>
            <Select {...register('categoryId')}>
              <option value="">Uncategorized</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Preferred supplier" error={errors.supplierId?.message}>
            <Select {...register('supplierId')}>
              <option value="">None</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Selling price" error={errors.unitPrice?.message} required>
            <Input inputMode="decimal" {...register('unitPrice')} placeholder="0.00" />
          </FormField>
          <FormField label="Cost price" error={errors.costPrice?.message} required>
            <Input inputMode="decimal" {...register('costPrice')} placeholder="0.00" />
          </FormField>
          <FormField label="Tax rate (%)" error={errors.taxRate?.message} required>
            <Input inputMode="decimal" {...register('taxRate')} />
          </FormField>
          <FormField label="Unit" error={errors.unit?.message} hint="e.g. pcs, box, kg" required>
            <Input {...register('unit')} />
          </FormField>
          <FormField label="Reorder level" error={errors.reorderLevel?.message} hint="Alert when stock falls to this level" required>
            <Input inputMode="numeric" {...register('reorderLevel')} />
          </FormField>
          {!product ? (
            <FormField label="Opening stock" error={errors.initialQuantity?.message} hint="Recorded as an adjustment movement">
              <Input inputMode="numeric" {...register('initialQuantity')} placeholder="0" />
            </FormField>
          ) : (
            <FormField label="Status">
              <Select {...register('active', { setValueAs: (v) => v === true || v === 'true' })}>
                <option value="true">Active</option>
                <option value="false">Archived</option>
              </Select>
            </FormField>
          )}
          <FormField label="Description" error={errors.description?.message} className="sm:col-span-2">
            <Textarea rows={3} {...register('description')} />
          </FormField>
        </form>
      </DialogContent>
    </Dialog>
  )
}
