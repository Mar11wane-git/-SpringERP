import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Plus, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { DataTable, FilterSelect, type Column } from '@/components/data-table/data-table'
import { PageHeader } from '@/components/layout/app-shell'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { FormField } from '@/components/ui/form-field'
import { Input, Select, Textarea } from '@/components/ui/input'
import { useAuth } from '@/features/auth/auth-context'
import { useOptions, usePagedQuery } from '@/hooks/use-paged-query'
import { useTableState } from '@/hooks/use-table-state'
import { api } from '@/lib/api'
import { formatDate, humanize, isoDate } from '@/lib/format'
import { handleMutationError } from '@/lib/mutations'
import { cn } from '@/lib/utils'
import { LEAVE_STATUSES, LEAVE_TYPES, type Employee, type LeaveRequest } from '@/types/api'

const schema = z
  .object({
    employeeId: z.string(),
    type: z.enum(LEAVE_TYPES),
    startDate: z.string().min(1, 'Required'),
    endDate: z.string().min(1, 'Required'),
    reason: z.string().max(500),
  })
  .refine((v) => v.endDate >= v.startDate, { path: ['endDate'], message: 'Must be on or after the start date' })
type Values = z.infer<typeof schema>

function RequestDialog({ trigger, forOthers }: { trigger: ReactNode; forOthers: boolean }) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const { data: employees = [] } = useOptions<Employee>('employees', '/api/employees', { status: 'ACTIVE', sort: 'lastName,asc' }, open && forOthers)
  const { register, handleSubmit, reset, setError, formState } = useForm<Values>({ resolver: zodResolver(schema) })
  useEffect(() => {
    if (open) reset({ employeeId: '', type: 'ANNUAL', startDate: isoDate(new Date()), endDate: isoDate(new Date()), reason: '' })
  }, [open, reset])

  const submit = async (v: Values) => {
    try {
      const created = await api.post<LeaveRequest>('/api/leave-requests', {
        employeeId: v.employeeId ? Number(v.employeeId) : null,
        type: v.type,
        startDate: v.startDate,
        endDate: v.endDate,
        reason: v.reason || null,
      })
      void queryClient.invalidateQueries({ queryKey: ['leave-requests'] })
      toast.success(`Request submitted: ${created.workingDays} working day(s)`)
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
        title="Request leave"
        description="Working days exclude weekends. Your approver is notified."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="leave-form" loading={formState.isSubmitting}>
              Submit request
            </Button>
          </>
        }
      >
        <form id="leave-form" onSubmit={handleSubmit(submit)} noValidate className="grid gap-4 sm:grid-cols-2">
          {forOthers && (
            <FormField label="Employee" hint="Leave empty to request for yourself" className="sm:col-span-2">
              <Select {...register('employeeId')}>
                <option value="">Myself</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.fullName}
                  </option>
                ))}
              </Select>
            </FormField>
          )}
          <FormField label="Type" required className="sm:col-span-2">
            <Select {...register('type')}>
              {LEAVE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {humanize(t)}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="First day" error={formState.errors.startDate?.message} required>
            <Input type="date" {...register('startDate')} />
          </FormField>
          <FormField label="Last day" error={formState.errors.endDate?.message} required>
            <Input type="date" {...register('endDate')} />
          </FormField>
          <FormField label="Reason" error={formState.errors.reason?.message} className="sm:col-span-2">
            <Textarea rows={2} {...register('reason')} />
          </FormField>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DecisionDialog({ leave, decision, trigger }: { leave: LeaveRequest; decision: 'approve' | 'reject'; trigger: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const queryClient = useQueryClient()
  const submit = async () => {
    setBusy(true)
    try {
      await api.post(`/api/leave-requests/${leave.id}/${decision}`, { note: note || null })
      void queryClient.invalidateQueries({ queryKey: ['leave-requests'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success(decision === 'approve' ? 'Leave approved' : 'Leave rejected')
      setOpen(false)
    } catch (e) {
      handleMutationError(e)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
      <span className="contents" onClick={() => setOpen(true)}>
        {trigger}
      </span>
      <DialogContent
        title={`${decision === 'approve' ? 'Approve' : 'Reject'} leave for ${leave.employee.name}?`}
        description={`${humanize(leave.type)} · ${formatDate(leave.startDate)} – ${formatDate(leave.endDate)} · ${leave.workingDays} working day(s)`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant={decision === 'approve' ? 'primary' : 'destructive'} onClick={submit} loading={busy}>
              {decision === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </>
        }
      >
        <FormField label="Note to the employee" hint="Optional">
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        </FormField>
      </DialogContent>
    </Dialog>
  )
}

export default function LeavePage() {
  const { can, user } = useAuth()
  const queryClient = useQueryClient()
  const canSeeAll = can('LEAVE_APPROVE') || can('EMPLOYEE_READ')
  const [scope, setScope] = useState<'mine' | 'all'>(canSeeAll ? 'all' : 'mine')
  const table = useTableState({ status: canSeeAll ? 'PENDING' : '' }, { key: 'createdAt', direction: 'desc' })
  const query = usePagedQuery<LeaveRequest>('leave-requests', '/api/leave-requests', { ...table.params, mine: scope === 'mine' ? true : undefined })
  const cancel = useMutation({
    mutationFn: (id: number) => api.post(`/api/leave-requests/${id}/cancel`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['leave-requests'] })
      toast.success('Request cancelled')
    },
    onError: (e) => handleMutationError(e),
  })

  const columns: Column<LeaveRequest>[] = [
    {
      id: 'employee',
      header: 'Employee',
      pinned: true,
      cell: (l) => (
        <>
          <span className="block font-medium">{l.employee.name}</span>
          <span className="block text-xs text-muted-foreground">{l.departmentName ?? '—'}</span>
        </>
      ),
    },
    { id: 'type', header: 'Type', cell: (l) => humanize(l.type) },
    { id: 'period', header: 'Period', sortKey: 'startDate', cell: (l) => `${formatDate(l.startDate)} – ${formatDate(l.endDate)}` },
    { id: 'days', header: 'Days', align: 'right', cell: (l) => l.workingDays },
    { id: 'reason', header: 'Reason', defaultHidden: true, cell: (l) => l.reason ?? '—' },
    {
      id: 'status',
      header: 'Status',
      sortKey: 'status',
      cell: (l) => (
        <span title={l.decisionNote ?? undefined}>
          <StatusBadge status={l.status} />
          {l.decidedBy && <span className="ml-2 text-xs text-muted-foreground">by {l.decidedBy}</span>}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      pinned: true,
      align: 'right',
      cell: (l) => {
        const own = l.employee.id === user?.employeeId
        return (
          <div className="flex justify-end gap-1">
            {l.status === 'PENDING' && can('LEAVE_APPROVE') && !own && (
              <>
                <DecisionDialog leave={l} decision="approve" trigger={<Button size="sm"><Check />Approve</Button>} />
                <DecisionDialog leave={l} decision="reject" trigger={<Button size="sm" variant="secondary"><X />Reject</Button>} />
              </>
            )}
            {(l.status === 'PENDING' || l.status === 'APPROVED') && (own || can('LEAVE_APPROVE')) && (
              <ConfirmDialog
                title="Cancel this leave request?"
                description={`${formatDate(l.startDate)} – ${formatDate(l.endDate)}`}
                confirmLabel="Cancel request"
                destructive
                onConfirm={() => cancel.mutateAsync(l.id)}
                trigger={<Button size="sm" variant="ghost">Cancel</Button>}
              />
            )}
          </div>
        )
      },
    },
  ]

  return (
    <>
      <PageHeader
        title="Leave"
        description={canSeeAll ? 'Requests awaiting decision and leave history.' : 'Your leave requests.'}
        actions={
          (user?.employeeId || can('EMPLOYEE_WRITE')) && (
            <RequestDialog
              forOthers={can('EMPLOYEE_WRITE')}
              trigger={
                <Button>
                  <Plus />
                  Request leave
                </Button>
              }
            />
          )
        }
      />
      {!user?.employeeId && !canSeeAll && (
        <p className="mb-4 rounded-md border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
          Your account is not linked to an employee record yet. Ask HR to link it to request leave.
        </p>
      )}
      <DataTable
        tableId="leave"
        columns={columns}
        page={query.data}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        sort={table.sort}
        onSort={table.toggleSort}
        onPageChange={table.setPage}
        pageSize={table.size}
        onPageSizeChange={table.setSize}
        rowKey={(l) => l.id}
        emptyTitle="No leave requests"
        toolbar={
          <>
            {canSeeAll && (
              <div className="inline-flex rounded-md bg-muted p-0.5" role="group" aria-label="Scope">
                {(['all', 'mine'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={scope === s}
                    onClick={() => {
                      setScope(s)
                      table.setPage(0)
                    }}
                    className={cn('rounded px-2.5 py-1 text-xs font-medium', scope === s ? 'bg-card shadow-xs' : 'text-muted-foreground')}
                  >
                    {s === 'all' ? 'Everyone' : 'My requests'}
                  </button>
                ))}
              </div>
            )}
            <FilterSelect
              label="Status"
              value={String(table.filters.status)}
              onChange={(v) => table.setFilter('status', v)}
              options={LEAVE_STATUSES.map((s) => ({ value: s, label: humanize(s) }))}
            />
          </>
        }
      />
    </>
  )
}
