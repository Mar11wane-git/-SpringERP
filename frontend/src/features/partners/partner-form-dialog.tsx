import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { FormField } from '@/components/ui/form-field'
import { Input, Select, Textarea } from '@/components/ui/input'
import { api, ApiError } from '@/lib/api'
import { handleMutationError } from '@/lib/mutations'
import type { Partner } from '@/types/api'

export type PartnerKind = 'customers' | 'suppliers'

const optionalEmail = z.union([z.literal(''), z.string().trim().email('Enter a valid email').max(150)])

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(150),
  contactName: z.string().max(150),
  email: optionalEmail,
  phone: z.string().max(40),
  taxId: z.string().max(50),
  addressLine: z.string().max(200),
  city: z.string().max(100),
  postalCode: z.string().max(20),
  country: z.string().max(100),
  notes: z.string().max(1000),
  active: z.string(),
})
type Values = z.infer<typeof schema>

const empty: Values = {
  name: '',
  contactName: '',
  email: '',
  phone: '',
  taxId: '',
  addressLine: '',
  city: '',
  postalCode: '',
  country: '',
  notes: '',
  active: 'true',
}

function toValues(p?: Partner): Values {
  if (!p) return empty
  return {
    name: p.name,
    contactName: p.contactName ?? '',
    email: p.email ?? '',
    phone: p.phone ?? '',
    taxId: p.taxId ?? '',
    addressLine: p.addressLine ?? '',
    city: p.city ?? '',
    postalCode: p.postalCode ?? '',
    country: p.country ?? '',
    notes: p.notes ?? '',
    active: String(p.active),
  }
}

export function PartnerFormDialog({ kind, partner, trigger }: { kind: PartnerKind; partner?: Partner; trigger: ReactNode }) {
  const label = kind === 'customers' ? 'customer' : 'supplier'
  const [open, setOpen] = useState(false)
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const { register, handleSubmit, reset, setError, formState } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: empty })
  const { errors, isSubmitting, isDirty } = formState

  useEffect(() => {
    if (open) reset(toValues(partner))
  }, [open, partner, reset])

  const save = async (v: Values, ignoreDuplicateWarning: boolean) => {
    const body = {
      ...Object.fromEntries(Object.entries(v).map(([k, val]) => [k, val.trim() === '' ? null : val.trim()])),
      active: v.active === 'true',
      ignoreDuplicateWarning,
      version: partner?.version ?? null,
    }
    try {
      const saved = partner
        ? await api.put<Partner>(`/api/${kind}/${partner.id}`, body)
        : await api.post<Partner>(`/api/${kind}`, body)
      void queryClient.invalidateQueries({ queryKey: [kind] })
      toast.success(`${saved.name} saved`)
      setOpen(false)
    } catch (e) {
      if (e instanceof ApiError && e.code === 'POSSIBLE_DUPLICATE') {
        setDuplicateWarning(e.message)
        return
      }
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
      <span
        className="contents"
        onClick={() => {
          setDuplicateWarning(null)
          setOpen(true)
        }}
      >
        {trigger}
      </span>
      <DialogContent
        title={partner ? `Edit ${partner.name}` : `New ${label}`}
        size="lg"
        footer={
          duplicateWarning ? (
            <>
              <Button variant="secondary" onClick={() => setDuplicateWarning(null)}>
                Review details
              </Button>
              <Button loading={isSubmitting} onClick={handleSubmit((v) => save(v, true))}>
                Save anyway
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" form="partner-form" loading={isSubmitting}>
                Save {label}
              </Button>
            </>
          )
        }
      >
        {duplicateWarning && (
          <div role="alert" className="mb-4 flex gap-2 rounded-md border border-warning/40 bg-warning-soft px-3 py-2.5 text-sm text-warning">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              {duplicateWarning} Check that this is not the same {label} before saving.
            </span>
          </div>
        )}
        <form id="partner-form" onSubmit={handleSubmit((v) => save(v, false))} noValidate className="grid gap-4 sm:grid-cols-2">
          <FormField label="Name" error={errors.name?.message} className="sm:col-span-2" required>
            <Input autoFocus {...register('name')} />
          </FormField>
          <FormField label="Contact person" error={errors.contactName?.message}>
            <Input {...register('contactName')} />
          </FormField>
          <FormField label="Email" error={errors.email?.message}>
            <Input type="email" {...register('email')} />
          </FormField>
          <FormField label="Phone" error={errors.phone?.message}>
            <Input type="tel" {...register('phone')} />
          </FormField>
          <FormField label="Tax ID" error={errors.taxId?.message}>
            <Input {...register('taxId')} />
          </FormField>
          <FormField label="Address" error={errors.addressLine?.message} className="sm:col-span-2">
            <Input {...register('addressLine')} autoComplete="street-address" />
          </FormField>
          <FormField label="Postal code" error={errors.postalCode?.message}>
            <Input {...register('postalCode')} />
          </FormField>
          <FormField label="City" error={errors.city?.message}>
            <Input {...register('city')} />
          </FormField>
          <FormField label="Country" error={errors.country?.message}>
            <Input {...register('country')} />
          </FormField>
          <FormField label="Status">
            <Select {...register('active')}>
              <option value="true">Active</option>
              <option value="false">Archived</option>
            </Select>
          </FormField>
          <FormField label="Notes" error={errors.notes?.message} className="sm:col-span-2">
            <Textarea rows={3} {...register('notes')} />
          </FormField>
        </form>
      </DialogContent>
    </Dialog>
  )
}
