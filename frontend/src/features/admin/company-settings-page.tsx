import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { PageHeader } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { ErrorState, Skeleton } from '@/components/ui/feedback'
import { FormField } from '@/components/ui/form-field'
import { Input, Textarea } from '@/components/ui/input'
import { useCompany } from '@/hooks/use-company'
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes'
import { api } from '@/lib/api'
import { handleMutationError } from '@/lib/mutations'
import type { Company } from '@/types/api'

const schema = z.object({
  name: z.string().trim().min(1, 'Required').max(150),
  legalName: z.string().max(200),
  taxId: z.string().max(50),
  email: z.union([z.literal(''), z.string().trim().email('Enter a valid email')]),
  phone: z.string().max(40),
  addressLine: z.string().max(200),
  city: z.string().max(100),
  postalCode: z.string().max(20),
  country: z.string().max(100),
  currency: z.string().trim().regex(/^[A-Z]{3}$/, '3-letter ISO code, e.g. EUR, MAD, USD'),
  timezone: z.string().trim().min(1, 'Required').max(60),
  defaultTaxRate: z.string().regex(/^\d{1,3}(\.\d{1,2})?$/, 'Enter a percentage').refine((v) => Number(v) <= 100, '≤ 100'),
  paymentTermsDays: z.string().regex(/^\d{1,3}$/, 'Days').refine((v) => Number(v) <= 365, '≤ 365'),
  invoiceFooter: z.string().max(500),
})
type Values = z.infer<typeof schema>

const ZONES: string[] = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? []

export default function CompanySettingsPage() {
  const { data, isLoading, error, refetch } = useCompany()
  const queryClient = useQueryClient()
  const { register, handleSubmit, reset, setError, formState } = useForm<Values>({ resolver: zodResolver(schema) })
  useUnsavedChanges(formState.isDirty)

  useEffect(() => {
    if (data)
      reset({
        name: data.name,
        legalName: data.legalName ?? '',
        taxId: data.taxId ?? '',
        email: data.email ?? '',
        phone: data.phone ?? '',
        addressLine: data.addressLine ?? '',
        city: data.city ?? '',
        postalCode: data.postalCode ?? '',
        country: data.country ?? '',
        currency: data.currency,
        timezone: data.timezone,
        defaultTaxRate: String(Number(data.defaultTaxRate)),
        paymentTermsDays: String(data.paymentTermsDays),
        invoiceFooter: data.invoiceFooter ?? '',
      })
  }, [data, reset])

  if (isLoading) return <Skeleton className="h-96" />
  if (error || !data) return <ErrorState error={error} onRetry={() => void refetch()} />

  const submit = async (v: Values) => {
    const body = {
      ...Object.fromEntries(Object.entries(v).map(([k, val]) => [k, val.trim() === '' ? null : val.trim()])),
      paymentTermsDays: Number(v.paymentTermsDays),
      version: data.version,
    }
    try {
      const saved = await api.put<Company>('/api/company', body)
      // Re-seeding the query resets the form (effect above), which clears the dirty state.
      queryClient.setQueryData(['company'], saved)
      toast.success('Company settings saved')
    } catch (e) {
      handleMutationError(e, setError)
    }
  }

  const e = formState.errors
  return (
    <form onSubmit={handleSubmit(submit)} noValidate>
      <PageHeader
        title="Company settings"
        description="Shown on invoices and used for currency, taxes, payment terms and business dates."
        actions={
          <Button type="submit" loading={formState.isSubmitting} disabled={!formState.isDirty}>
            Save changes
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Identity" />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <FormField label="Trading name" error={e.name?.message} required className="sm:col-span-2"><Input {...register('name')} /></FormField>
            <FormField label="Legal name" error={e.legalName?.message}><Input {...register('legalName')} /></FormField>
            <FormField label="Tax / VAT ID" error={e.taxId?.message}><Input {...register('taxId')} /></FormField>
            <FormField label="Email" error={e.email?.message}><Input type="email" {...register('email')} /></FormField>
            <FormField label="Phone" error={e.phone?.message}><Input {...register('phone')} /></FormField>
            <FormField label="Address" error={e.addressLine?.message} className="sm:col-span-2"><Input {...register('addressLine')} /></FormField>
            <FormField label="Postal code" error={e.postalCode?.message}><Input {...register('postalCode')} /></FormField>
            <FormField label="City" error={e.city?.message}><Input {...register('city')} /></FormField>
            <FormField label="Country" error={e.country?.message}><Input {...register('country')} /></FormField>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Defaults" description="Changes apply to new documents only; issued invoices keep their values." />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <FormField label="Currency" error={e.currency?.message} required><Input className="uppercase" maxLength={3} {...register('currency')} /></FormField>
            <FormField label="Time zone" error={e.timezone?.message} hint="Defines “today” for due dates and reports" required>
              <Input list="timezones" {...register('timezone')} />
            </FormField>
            <datalist id="timezones">
              {ZONES.map((z) => <option key={z} value={z} />)}
            </datalist>
            <FormField label="Default tax rate (%)" error={e.defaultTaxRate?.message} required><Input inputMode="decimal" {...register('defaultTaxRate')} /></FormField>
            <FormField label="Payment terms (days)" error={e.paymentTermsDays?.message} required><Input inputMode="numeric" {...register('paymentTermsDays')} /></FormField>
            <FormField label="Invoice footer" error={e.invoiceFooter?.message} hint="Bank details, legal mentions…" className="sm:col-span-2"><Textarea rows={3} {...register('invoiceFooter')} /></FormField>
          </CardBody>
        </Card>
      </div>
    </form>
  )
}
