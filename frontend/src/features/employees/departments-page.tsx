import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, Pencil, Plus } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { PageHeader } from '@/components/layout/app-shell'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback'
import { FormField } from '@/components/ui/form-field'
import { Input, Select, Textarea } from '@/components/ui/input'
import { useAuth } from '@/features/auth/auth-context'
import { useOptions } from '@/hooks/use-paged-query'
import { api } from '@/lib/api'
import { handleMutationError } from '@/lib/mutations'
import type { Department, Employee } from '@/types/api'

const schema = z.object({
  code: z.string().trim().min(1, 'Required').max(20).regex(/^[A-Za-z0-9_-]+$/, 'Letters, digits, - and _ only'),
  name: z.string().trim().min(1, 'Required').max(100),
  description: z.string().max(500),
  parentId: z.string(),
  managerId: z.string(),
  active: z.string(),
})
type Values = z.infer<typeof schema>

function DepartmentDialog({ department, all, trigger }: { department?: Department; all: Department[]; trigger: ReactNode }) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const { data: employees = [] } = useOptions<Employee>('employees', '/api/employees', { status: 'ACTIVE', sort: 'lastName,asc' }, open)
  const { register, handleSubmit, reset, setError, formState } = useForm<Values>({ resolver: zodResolver(schema) })
  useEffect(() => {
    if (open)
      reset({
        code: department?.code ?? '',
        name: department?.name ?? '',
        description: department?.description ?? '',
        parentId: department?.parent ? String(department.parent.id) : '',
        managerId: department?.manager ? String(department.manager.id) : '',
        active: String(department?.active ?? true),
      })
  }, [open, department, reset])

  const submit = async (v: Values) => {
    const body = {
      code: v.code,
      name: v.name,
      description: v.description || null,
      parentId: v.parentId ? Number(v.parentId) : null,
      managerId: v.managerId ? Number(v.managerId) : null,
      active: v.active === 'true',
      version: department?.version ?? null,
    }
    try {
      await (department ? api.put(`/api/departments/${department.id}`, body) : api.post('/api/departments', body))
      void queryClient.invalidateQueries({ queryKey: ['departments'] })
      toast.success('Department saved')
      setOpen(false)
    } catch (e) {
      handleMutationError(e, setError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <span className="contents" onClick={() => setOpen(true)}>
        {trigger}
      </span>
      <DialogContent
        title={department ? `Edit ${department.name}` : 'New department'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="department-form" loading={formState.isSubmitting}>
              Save
            </Button>
          </>
        }
      >
        <form id="department-form" onSubmit={handleSubmit(submit)} noValidate className="grid gap-4 sm:grid-cols-2">
          <FormField label="Code" error={formState.errors.code?.message} required>
            <Input className="uppercase" {...register('code')} />
          </FormField>
          <FormField label="Name" error={formState.errors.name?.message} required>
            <Input {...register('name')} />
          </FormField>
          <FormField label="Parent department">
            <Select {...register('parentId')}>
              <option value="">None (top level)</option>
              {all
                .filter((d) => d.id !== department?.id)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </Select>
          </FormField>
          <FormField label="Manager">
            <Select {...register('managerId')}>
              <option value="">None</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fullName}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Status">
            <Select {...register('active')}>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </Select>
          </FormField>
          <FormField label="Description" error={formState.errors.description?.message} className="sm:col-span-2">
            <Textarea rows={2} {...register('description')} />
          </FormField>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Organization structure: departments rendered as a tree by parent. */
export default function DepartmentsPage() {
  const { can } = useAuth()
  const { data = [], isLoading, error, refetch } = useQuery({ queryKey: ['departments'], queryFn: () => api.get<Department[]>('/api/departments') })
  const writable = can('EMPLOYEE_WRITE')

  const children = (parentId: number | null) => data.filter((d) => (d.parent?.id ?? null) === parentId)
  const renderLevel = (parentId: number | null, depth: number): ReactNode =>
    children(parentId).map((d) => (
      <div key={d.id}>
        <div className="flex items-center gap-4 border-b border-border px-5 py-3" style={{ paddingLeft: `${1.25 + depth * 1.5}rem` }}>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              {d.name} <span className="ml-1 text-xs font-normal text-muted-foreground">{d.code}</span>
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {d.manager ? `Managed by ${d.manager.name}` : 'No manager assigned'}
              {d.description && ` · ${d.description}`}
            </p>
          </div>
          <span className="text-xs text-muted-foreground tabular">{d.employeeCount} people</span>
          {!d.active && <StatusBadge status="INACTIVE" />}
          {writable && (
            <DepartmentDialog
              department={d}
              all={data}
              trigger={
                <Button variant="ghost" size="icon-sm" aria-label={`Edit ${d.name}`}>
                  <Pencil />
                </Button>
              }
            />
          )}
        </div>
        {renderLevel(d.id, depth + 1)}
      </div>
    ))

  return (
    <>
      <PageHeader
        title="Departments"
        description="Organization structure and headcount."
        actions={
          writable && (
            <DepartmentDialog
              all={data}
              trigger={
                <Button>
                  <Plus />
                  New department
                </Button>
              }
            />
          )
        }
      />
      <Card className="overflow-hidden">
        {isLoading && <Skeleton className="m-4 h-32" />}
        {error && <ErrorState error={error} onRetry={() => void refetch()} />}
        {!isLoading && !error && data.length === 0 && <EmptyState icon={Building2} title="No departments yet" />}
        <div className="[&>div:last-child>div:last-child]:border-0">{renderLevel(null, 0)}</div>
      </Card>
    </>
  )
}
