import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { FormField } from '@/components/ui/form-field'
import { Input, Select } from '@/components/ui/input'
import { useOptions } from '@/hooks/use-paged-query'
import { api } from '@/lib/api'
import { humanize, isoDate } from '@/lib/format'
import { handleMutationError } from '@/lib/mutations'
import { EMPLOYMENT_TYPES, type Department, type Employee } from '@/types/api'

const schema = z
  .object({
    firstName: z.string().trim().min(1, 'Required').max(80),
    lastName: z.string().trim().min(1, 'Required').max(80),
    email: z.string().trim().min(1, 'Required').email('Enter a valid email').max(150),
    phone: z.string().max(40),
    jobTitle: z.string().trim().min(1, 'Required').max(100),
    departmentId: z.string(),
    managerId: z.string(),
    userEmail: z.union([z.literal(''), z.string().trim().email('Enter a valid email')]),
    employmentType: z.enum(EMPLOYMENT_TYPES),
    hireDate: z.string().min(1, 'Required'),
    contractEndDate: z.string(),
  })
  .refine((v) => !v.contractEndDate || v.contractEndDate >= v.hireDate, {
    path: ['contractEndDate'],
    message: 'Must be after the hire date',
  })
type Values = z.infer<typeof schema>

function toValues(e?: Employee): Values {
  return {
    firstName: e?.firstName ?? '',
    lastName: e?.lastName ?? '',
    email: e?.email ?? '',
    phone: e?.phone ?? '',
    jobTitle: e?.jobTitle ?? '',
    departmentId: e?.department ? String(e.department.id) : '',
    managerId: e?.manager ? String(e.manager.id) : '',
    userEmail: e?.userEmail ?? '',
    employmentType: e?.employmentType ?? 'FULL_TIME',
    hireDate: e?.hireDate ?? isoDate(new Date()),
    contractEndDate: e?.contractEndDate ?? '',
  }
}

export function EmployeeFormDialog({ employee, trigger }: { employee?: Employee; trigger: ReactNode }) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: () => api.get<Department[]>('/api/departments'), enabled: open })
  const { data: managers = [] } = useOptions<Employee>('employees', '/api/employees', { status: 'ACTIVE', sort: 'lastName,asc' }, open)
  const { register, handleSubmit, reset, setError, formState } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toValues(employee) })

  useEffect(() => {
    if (open) reset(toValues(employee))
  }, [open, employee, reset])

  const submit = async (v: Values) => {
    const body = {
      ...v,
      phone: v.phone || null,
      departmentId: v.departmentId ? Number(v.departmentId) : null,
      managerId: v.managerId ? Number(v.managerId) : null,
      userEmail: v.userEmail || null,
      contractEndDate: v.contractEndDate || null,
      version: employee?.version ?? null,
    }
    try {
      const saved = employee ? await api.put<Employee>(`/api/employees/${employee.id}`, body) : await api.post<Employee>('/api/employees', body)
      void queryClient.invalidateQueries({ queryKey: ['employees'] })
      void queryClient.invalidateQueries({ queryKey: ['departments'] })
      toast.success(`${saved.fullName} saved`)
      setOpen(false)
    } catch (e) {
      handleMutationError(e, setError)
    }
  }

  const { errors, isSubmitting, isDirty } = formState
  return (
    <Dialog open={open} onOpenChange={(o) => {
      if (!o && isDirty && !isSubmitting && !window.confirm('Discard unsaved changes?')) return
      setOpen(o)
    }}>
      <span className="contents" onClick={() => setOpen(true)}>
        {trigger}
      </span>
      <DialogContent
        title={employee ? `Edit ${employee.fullName}` : 'New employee'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" form="employee-form" loading={isSubmitting}>
              Save employee
            </Button>
          </>
        }
      >
        <form id="employee-form" onSubmit={handleSubmit(submit)} noValidate className="grid gap-4 sm:grid-cols-2">
          <FormField label="First name" error={errors.firstName?.message} required>
            <Input autoFocus {...register('firstName')} />
          </FormField>
          <FormField label="Last name" error={errors.lastName?.message} required>
            <Input {...register('lastName')} />
          </FormField>
          <FormField label="Work email" error={errors.email?.message} required>
            <Input type="email" {...register('email')} />
          </FormField>
          <FormField label="Phone" error={errors.phone?.message}>
            <Input type="tel" {...register('phone')} />
          </FormField>
          <FormField label="Job title" error={errors.jobTitle?.message} required>
            <Input {...register('jobTitle')} />
          </FormField>
          <FormField label="Employment type" error={errors.employmentType?.message} required>
            <Select {...register('employmentType')}>
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {humanize(t)}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Department">
            <Select {...register('departmentId')}>
              <option value="">Unassigned</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Manager">
            <Select {...register('managerId')}>
              <option value="">None</option>
              {managers
                .filter((m) => m.id !== employee?.id)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.fullName} · {m.jobTitle}
                  </option>
                ))}
            </Select>
          </FormField>
          <FormField label="Hire date" error={errors.hireDate?.message} required>
            <Input type="date" {...register('hireDate')} />
          </FormField>
          <FormField label="Contract end date" error={errors.contractEndDate?.message} hint="For fixed-term contracts">
            <Input type="date" {...register('contractEndDate')} />
          </FormField>
          <FormField
            label="Linked user account"
            error={errors.userEmail?.message}
            hint="Login email of this employee's account; enables self-service leave requests."
            className="sm:col-span-2"
          >
            <Input type="email" {...register('userEmail')} placeholder="Optional" />
          </FormField>
        </form>
      </DialogContent>
    </Dialog>
  )
}
