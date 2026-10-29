import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, FileUp, Pencil, RefreshCcw, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'

import { PageHeader } from '@/components/layout/app-shell'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DefinitionList } from '@/components/ui/definition-list'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { ErrorState, Skeleton } from '@/components/ui/feedback'
import { FormField } from '@/components/ui/form-field'
import { Input, Select } from '@/components/ui/input'
import { useAuth } from '@/features/auth/auth-context'
import { api } from '@/lib/api'
import { formatDate, formatDateTime, humanize, isoDate } from '@/lib/format'
import { handleMutationError } from '@/lib/mutations'
import {
  DOCUMENT_CATEGORIES,
  EMPLOYEE_STATUSES,
  type DocumentCategory,
  type Employee,
  type EmployeeDocument,
  type StatusChange,
} from '@/types/api'

import { EmployeeFormDialog } from './employee-form-dialog'

const MAX_BYTES = 5 * 1024 * 1024
const ACCEPT = 'application/pdf,image/png,image/jpeg'

function StatusDialog({ employee, trigger }: { employee: Employee; trigger: ReactNode }) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const schema = z.object({
    status: z.enum(EMPLOYEE_STATUSES).refine((s) => s !== employee.status, 'Choose a different status'),
    effectiveDate: z.string(),
    note: z.string().max(255),
  })
  type Values = z.infer<typeof schema>
  const { register, handleSubmit, reset, control, setError, formState } = useForm<Values>({ resolver: zodResolver(schema) })
  const status = useWatch({ control, name: 'status' })
  useEffect(() => {
    if (open) reset({ status: employee.status === 'ACTIVE' ? 'ON_LEAVE' : 'ACTIVE', effectiveDate: isoDate(new Date()), note: '' })
  }, [open, employee.status, reset])

  const submit = async (v: Values) => {
    try {
      await api.post(`/api/employees/${employee.id}/status`, { ...v, effectiveDate: v.effectiveDate || null, note: v.note || null })
      void queryClient.invalidateQueries({ queryKey: ['employees'] })
      toast.success('Status updated')
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
        title="Change employment status"
        description={`Currently ${humanize(employee.status)}. The change is kept in the status history.`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="status-form" loading={formState.isSubmitting} variant={status === 'TERMINATED' ? 'destructive' : 'primary'}>
              Update status
            </Button>
          </>
        }
      >
        <form id="status-form" onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-4">
          <FormField label="New status" error={formState.errors.status?.message} required>
            <Select {...register('status')}>
              {EMPLOYEE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {humanize(s)}
                </option>
              ))}
            </Select>
          </FormField>
          {status === 'TERMINATED' && (
            <FormField label="Termination date" hint="Termination is final and cannot be reversed.">
              <Input type="date" {...register('effectiveDate')} />
            </FormField>
          )}
          <FormField label="Note" error={formState.errors.note?.message}>
            <Input {...register('note')} />
          </FormField>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Documents({ employeeId }: { employeeId: number }) {
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [category, setCategory] = useState<DocumentCategory>('CONTRACT')
  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['employees', employeeId, 'documents'],
    queryFn: () => api.get<EmployeeDocument[]>(`/api/employees/${employeeId}/documents`),
  })
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['employees', employeeId, 'documents'] })
  const upload = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.append('file', file)
      return api.upload<EmployeeDocument>(`/api/employees/${employeeId}/documents`, form, { category })
    },
    onSuccess: () => {
      void invalidate()
      toast.success('Document uploaded')
    },
    onError: (e) => handleMutationError(e),
  })
  const remove = useMutation({
    mutationFn: (docId: number) => api.delete(`/api/employees/${employeeId}/documents/${docId}`),
    onSuccess: () => {
      void invalidate()
      toast.success('Document deleted')
    },
    onError: (e) => handleMutationError(e),
  })

  const onFile = (file: File | undefined) => {
    if (!file) return
    if (file.size > MAX_BYTES) return void toast.error('The file exceeds the 5 MB limit.')
    if (!ACCEPT.split(',').includes(file.type)) return void toast.error('Only PDF, PNG and JPEG files are accepted.')
    upload.mutate(file)
  }

  return (
    <Card>
      <CardHeader
        title="Employment documents"
        description="Contracts and certificates. PDF, PNG or JPEG, 5 MB max. Access is restricted to HR."
        action={
          <div className="flex items-center gap-2">
            <Select aria-label="Document category" value={category} onChange={(e) => setCategory(e.target.value as DocumentCategory)} className="h-8 w-auto text-[13px]">
              {DOCUMENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {humanize(c)}
                </option>
              ))}
            </Select>
            <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = '' }} />
            <Button size="sm" onClick={() => fileRef.current?.click()} loading={upload.isPending}>
              <FileUp />
              Upload
            </Button>
          </div>
        }
      />
      <div className="border-t border-border">
        {isLoading ? (
          <Skeleton className="m-4 h-10" />
        ) : docs.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">No documents uploaded.</p>
        ) : (
          <ul>
            {docs.map((d) => (
              <li key={d.id} className="flex items-center gap-3 border-b border-border px-5 py-2.5 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{d.originalFilename}</p>
                  <p className="text-xs text-muted-foreground">
                    {humanize(d.category)} · {(d.sizeBytes / 1024).toFixed(0)} KB · {formatDateTime(d.uploadedAt)}
                  </p>
                </div>
                <Button variant="ghost" size="icon-sm" aria-label={`Download ${d.originalFilename}`} onClick={() => void api.download(`/api/employees/${employeeId}/documents/${d.id}`).catch((e: unknown) => handleMutationError(e))}>
                  <Download />
                </Button>
                <ConfirmDialog
                  title="Delete document?"
                  description={`${d.originalFilename} will be removed permanently.`}
                  confirmLabel="Delete"
                  destructive
                  onConfirm={() => remove.mutateAsync(d.id)}
                  trigger={
                    <Button variant="ghost" size="icon-sm" aria-label={`Delete ${d.originalFilename}`}>
                      <Trash2 />
                    </Button>
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}

export default function EmployeeDetailPage() {
  const { id } = useParams()
  const { can } = useAuth()
  const { data: employee, isLoading, error, refetch } = useQuery({
    queryKey: ['employees', Number(id)],
    queryFn: () => api.get<Employee>(`/api/employees/${id}`),
  })
  const { data: history = [] } = useQuery({
    queryKey: ['employees', Number(id), 'history'],
    queryFn: () => api.get<StatusChange[]>(`/api/employees/${id}/status-history`),
  })

  if (isLoading) return <Skeleton className="h-96" />
  if (error || !employee) return <ErrorState error={error} onRetry={() => void refetch()} />
  const writable = can('EMPLOYEE_WRITE')

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            {employee.fullName}
            <StatusBadge status={employee.status} />
          </span>
        }
        description={`${employee.jobTitle} · ${employee.employeeNumber}`}
        actions={
          writable &&
          employee.status !== 'TERMINATED' && (
            <>
              <StatusDialog
                employee={employee}
                trigger={
                  <Button variant="secondary">
                    <RefreshCcw />
                    Change status
                  </Button>
                }
              />
              <EmployeeFormDialog
                employee={employee}
                trigger={
                  <Button>
                    <Pencil />
                    Edit
                  </Button>
                }
              />
            </>
          )
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Employment" />
          <CardBody>
            <DefinitionList
              items={[
                ['Department', employee.department?.name ?? 'Unassigned'],
                ['Manager', employee.manager?.name ?? '—'],
                ['Employment type', humanize(employee.employmentType)],
                ['Hire date', formatDate(employee.hireDate)],
                ['Contract end', employee.contractEndDate ? formatDate(employee.contractEndDate) : '—'],
                ['Termination date', employee.terminationDate ? formatDate(employee.terminationDate) : '—'],
                ['Work email', <a href={`mailto:${employee.email}`} className="text-primary hover:underline">{employee.email}</a>],
                ['Phone', employee.phone],
                ['User account', employee.userEmail ?? 'Not linked'],
              ]}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Status history" />
          <CardBody>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">No changes recorded.</p>
            ) : (
              <ol className="relative space-y-4 border-l border-border pl-4">
                {history.map((h) => (
                  <li key={h.id}>
                    <span className="absolute -left-[5px] mt-1.5 size-2.5 rounded-full border-2 border-card bg-primary" aria-hidden />
                    <p className="text-sm">
                      {h.fromStatus ? `${humanize(h.fromStatus)} → ` : ''}
                      <span className="font-medium">{humanize(h.toStatus)}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(h.changedAt)}
                      {h.changedBy && ` · ${h.changedBy}`}
                    </p>
                    {h.note && <p className="mt-0.5 text-xs">{h.note}</p>}
                  </li>
                ))}
              </ol>
            )}
          </CardBody>
        </Card>
        {writable && (
          <div className="lg:col-span-3">
            <Documents employeeId={employee.id} />
          </div>
        )}
      </div>
    </>
  )
}
