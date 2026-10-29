import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { KeyRound, MoreHorizontal, Pencil, Plus, Power } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { DataTable, FilterSelect, SearchInput, type Column } from '@/components/data-table/data-table'
import { PageHeader } from '@/components/layout/app-shell'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { FormField } from '@/components/ui/form-field'
import { Input, Select } from '@/components/ui/input'
import { useAuth } from '@/features/auth/auth-context'
import { passwordSchema } from '@/features/auth/schemas'
import { usePagedQuery } from '@/hooks/use-paged-query'
import { useTableState } from '@/hooks/use-table-state'
import { api } from '@/lib/api'
import { formatDateTime, humanize } from '@/lib/format'
import { handleMutationError } from '@/lib/mutations'
import { ROLES, type Role, type User } from '@/types/api'

const ROLE_HINTS: Record<Role, string> = {
  ADMIN: 'Full access including users, settings and audit log',
  MANAGER: 'Sales, inventory, reports and approvals; no administration',
  HR: 'Employees, departments, documents and leave approval',
  SALES: 'Customers, quotes and orders; read-only inventory',
  WAREHOUSE: 'Products, stock receipts, issues and adjustments',
  ACCOUNTANT: 'Invoices, payments and financial reports',
  EMPLOYEE: 'Own leave requests and the departments directory',
}

const createSchema = z.object({
  fullName: z.string().trim().min(1, 'Required').max(150),
  email: z.string().trim().min(1, 'Required').email('Enter a valid email').max(150),
  role: z.enum(ROLES),
  temporaryPassword: passwordSchema,
})
const editSchema = createSchema.pick({ fullName: true, role: true })

interface UserDialogProps {
  user?: User
  trigger?: ReactNode
  /** Controlled mode, used when the dialog is opened from a menu that unmounts on close. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

function UserDialog({ user, trigger, open: controlledOpen, onOpenChange }: UserDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen
  const queryClient = useQueryClient()
  const schema = user ? editSchema : createSchema
  const { register, handleSubmit, reset, control, setError, formState } = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(schema as typeof createSchema),
  })
  useEffect(() => {
    if (open) reset({ fullName: user?.fullName ?? '', email: user?.email ?? '', role: user?.role ?? 'EMPLOYEE', temporaryPassword: '' })
  }, [open, user, reset])

  const submit = async (v: z.infer<typeof createSchema>) => {
    try {
      if (user) await api.put(`/api/users/${user.id}`, { fullName: v.fullName, role: v.role })
      else await api.post('/api/users', v)
      void queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success(user ? 'User updated' : `Account created. Share the temporary password with ${v.fullName} securely.`)
      setOpen(false)
    } catch (e) {
      handleMutationError(e, setError)
    }
  }
  const role = useWatch({ control, name: 'role' })
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && (
        <span className="contents" onClick={() => setOpen(true)}>
          {trigger}
        </span>
      )}
      <DialogContent
        title={user ? `Edit ${user.fullName}` : 'Invite user'}
        description={user ? 'Changing the role signs the user out of active sessions.' : 'The user must choose a new password at first sign-in.'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="user-form" loading={formState.isSubmitting}>
              {user ? 'Save' : 'Create account'}
            </Button>
          </>
        }
      >
        <form id="user-form" onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-4">
          <FormField label="Full name" error={formState.errors.fullName?.message} required>
            <Input autoFocus {...register('fullName')} />
          </FormField>
          {!user && (
            <FormField label="Email" error={formState.errors.email?.message} required>
              <Input type="email" autoComplete="off" {...register('email')} />
            </FormField>
          )}
          <FormField label="Role" hint={role ? ROLE_HINTS[role] : undefined} required>
            <Select {...register('role')}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {humanize(r)}
                </option>
              ))}
            </Select>
          </FormField>
          {!user && (
            <FormField label="Temporary password" error={formState.errors.temporaryPassword?.message} hint="At least 10 characters with letters and digits." required>
              <Input type="text" autoComplete="new-password" {...register('temporaryPassword')} />
            </FormField>
          )}
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ResetPasswordDialog({ user, open, onOpenChange }: { user: User; open: boolean; onOpenChange: (o: boolean) => void }) {
  const schema = z.object({ temporaryPassword: passwordSchema })
  const { register, handleSubmit, reset, setError, formState } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) })
  const queryClient = useQueryClient()
  useEffect(() => {
    if (open) reset({ temporaryPassword: '' })
  }, [open, reset])
  const submit = async (v: z.infer<typeof schema>) => {
    try {
      await api.post(`/api/users/${user.id}/reset-password`, v)
      void queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('Temporary password set. The user must change it at next sign-in.')
      onOpenChange(false)
    } catch (e) {
      handleMutationError(e, setError)
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={`Reset password for ${user.fullName}`}
        description="All of the user's sessions are signed out and the account is unlocked."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" form="reset-form" loading={formState.isSubmitting}>
              Set temporary password
            </Button>
          </>
        }
      >
        <form id="reset-form" onSubmit={handleSubmit(submit)} noValidate>
          <FormField label="Temporary password" error={formState.errors.temporaryPassword?.message} required>
            <Input type="text" autoComplete="new-password" autoFocus {...register('temporaryPassword')} />
          </FormField>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function RowActions({ user }: { user: User }) {
  const { user: me } = useAuth()
  const [resetOpen, setResetOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const queryClient = useQueryClient()
  const toggle = useMutation({
    mutationFn: () => api.patch<User>(`/api/users/${user.id}/active`, { active: !user.active }),
    onSuccess: (u) => {
      void queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success(u.active ? `${u.fullName} reactivated` : `${u.fullName} deactivated and signed out`)
    },
    onError: (e) => handleMutationError(e),
  })
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${user.fullName}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <Pencil />
            Edit name or role
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setResetOpen(true)}>
            <KeyRound />
            Reset password
          </DropdownMenuItem>
          {user.id !== me?.id && (
            <DropdownMenuItem
              onSelect={() => {
                if (window.confirm(user.active ? `Deactivate ${user.fullName}? They will be signed out immediately.` : `Reactivate ${user.fullName}?`)) toggle.mutate()
              }}
            >
              <Power />
              {user.active ? 'Deactivate' : 'Reactivate'}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <UserDialog user={user} open={editOpen} onOpenChange={setEditOpen} />
      <ResetPasswordDialog user={user} open={resetOpen} onOpenChange={setResetOpen} />
    </>
  )
}

export default function UsersPage() {
  const { can } = useAuth()
  const table = useTableState({ role: '', active: '' }, { key: 'fullName', direction: 'asc' })
  const query = usePagedQuery<User>('users', '/api/users', table.params)
  const columns: Column<User>[] = [
    {
      id: 'name',
      header: 'User',
      sortKey: 'fullName',
      pinned: true,
      cell: (u) => (
        <>
          <span className="block font-medium">{u.fullName}</span>
          <span className="block text-xs text-muted-foreground">{u.email}</span>
        </>
      ),
    },
    { id: 'role', header: 'Role', sortKey: 'role', cell: (u) => <Badge tone="info">{humanize(u.role)}</Badge> },
    {
      id: 'status',
      header: 'Status',
      cell: (u) => (
        <span className="flex flex-wrap gap-1">
          <StatusBadge status={u.active ? 'ACTIVE' : 'INACTIVE'} />
          {u.locked && <StatusBadge status="LOCKED" />}
          {u.mustChangePassword && <Badge tone="warning">Temporary password</Badge>}
        </span>
      ),
    },
    { id: 'lastLogin', header: 'Last sign-in', sortKey: 'lastLoginAt', cell: (u) => (u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'Never') },
    { id: 'created', header: 'Created', sortKey: 'createdAt', defaultHidden: true, cell: (u) => formatDateTime(u.createdAt) },
    { id: 'actions', header: '', pinned: true, align: 'right', cell: (u) => (can('USER_WRITE') ? <RowActions user={u} /> : null) },
  ]
  return (
    <>
      <PageHeader
        title="Users"
        description="Sign-in accounts and their roles. Every change is audited."
        actions={
          can('USER_WRITE') && (
            <UserDialog
              trigger={
                <Button>
                  <Plus />
                  Invite user
                </Button>
              }
            />
          )
        }
      />
      <DataTable
        tableId="users"
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
        rowKey={(u) => u.id}
        emptyTitle="No users found"
        toolbar={
          <>
            <SearchInput value={table.search} onChange={table.setSearch} placeholder="Search name or email" />
            <FilterSelect label="Role" value={String(table.filters.role)} onChange={(v) => table.setFilter('role', v)} options={ROLES.map((r) => ({ value: r, label: humanize(r) }))} />
            <FilterSelect label="Status" value={String(table.filters.active)} onChange={(v) => table.setFilter('active', v)} options={[{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }]} />
          </>
        }
      />
    </>
  )
}
