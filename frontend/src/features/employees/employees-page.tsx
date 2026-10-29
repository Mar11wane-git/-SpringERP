import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { Link } from 'react-router-dom'

import { DataTable, FilterSelect, SearchInput, type Column } from '@/components/data-table/data-table'
import { PageHeader } from '@/components/layout/app-shell'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-context'
import { usePagedQuery } from '@/hooks/use-paged-query'
import { useTableState } from '@/hooks/use-table-state'
import { api } from '@/lib/api'
import { formatDate, humanize } from '@/lib/format'
import { EMPLOYEE_STATUSES, type Department, type Employee } from '@/types/api'

import { EmployeeFormDialog } from './employee-form-dialog'

export default function EmployeesPage() {
  const { can } = useAuth()
  const table = useTableState({ departmentId: '', status: 'ACTIVE' }, { key: 'lastName', direction: 'asc' })
  const query = usePagedQuery<Employee>('employees', '/api/employees', table.params)
  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: () => api.get<Department[]>('/api/departments') })

  const columns: Column<Employee>[] = [
    {
      id: 'name',
      header: 'Employee',
      sortKey: 'lastName',
      pinned: true,
      cell: (e) => (
        <Link to={`/employees/${e.id}`} className="block hover:underline">
          <span className="block font-medium">{e.fullName}</span>
          <span className="block text-xs text-muted-foreground">{e.employeeNumber}</span>
        </Link>
      ),
    },
    { id: 'title', header: 'Job title', sortKey: 'jobTitle', cell: (e) => e.jobTitle },
    { id: 'department', header: 'Department', cell: (e) => e.department?.name ?? <span className="text-muted-foreground">Unassigned</span> },
    { id: 'manager', header: 'Manager', defaultHidden: true, cell: (e) => e.manager?.name ?? '—' },
    { id: 'email', header: 'Email', defaultHidden: true, cell: (e) => e.email },
    { id: 'type', header: 'Type', cell: (e) => humanize(e.employmentType) },
    { id: 'hired', header: 'Hired', sortKey: 'hireDate', cell: (e) => formatDate(e.hireDate) },
    { id: 'status', header: 'Status', sortKey: 'status', cell: (e) => <StatusBadge status={e.status} /> },
  ]

  return (
    <>
      <PageHeader
        title="Employees"
        description="Employee records, roles and employment details."
        actions={
          can('EMPLOYEE_WRITE') && (
            <EmployeeFormDialog
              trigger={
                <Button>
                  <Plus />
                  New employee
                </Button>
              }
            />
          )
        }
      />
      <DataTable
        tableId="employees"
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
        rowKey={(e) => e.id}
        rowHref={(e) => `/employees/${e.id}`}
        emptyTitle="No employees match"
        toolbar={
          <>
            <SearchInput value={table.search} onChange={table.setSearch} placeholder="Search name, email, number, title" />
            <FilterSelect
              label="Department"
              value={String(table.filters.departmentId)}
              onChange={(v) => table.setFilter('departmentId', v)}
              options={departments.map((d) => ({ value: String(d.id), label: d.name }))}
            />
            <FilterSelect
              label="Status"
              value={String(table.filters.status)}
              onChange={(v) => table.setFilter('status', v)}
              options={EMPLOYEE_STATUSES.map((s) => ({ value: s, label: humanize(s) }))}
            />
          </>
        }
      />
    </>
  )
}
