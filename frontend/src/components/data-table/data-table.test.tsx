import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import type { Page } from '@/types/api'

import { DataTable, type Column } from './data-table'

interface Row {
  id: number
  name: string
  qty: number
}

const columns: Column<Row>[] = [
  { id: 'name', header: 'Name', sortKey: 'name', pinned: true, cell: (r) => r.name },
  { id: 'qty', header: 'Quantity', align: 'right', cell: (r) => r.qty },
]

function page(content: Row[], extra: Partial<Page<Row>> = {}): Page<Row> {
  return { content, page: 0, size: 20, totalElements: content.length, totalPages: 1, ...extra }
}

function renderTable(props: Partial<Parameters<typeof DataTable<Row>>[0]> = {}) {
  const handlers = { onSort: vi.fn(), onPageChange: vi.fn(), onRetry: vi.fn(), onPageSizeChange: vi.fn() }
  render(
    <MemoryRouter>
      <DataTable<Row>
        tableId={`test-${Math.random()}`}
        columns={columns}
        page={page([{ id: 1, name: 'Chair', qty: 4 }])}
        isLoading={false}
        error={null}
        pageSize={20}
        rowKey={(r) => r.id}
        emptyTitle="Nothing here"
        {...handlers}
        {...props}
      />
    </MemoryRouter>,
  )
  return handlers
}

describe('DataTable', () => {
  it('renders rows and the result range', () => {
    renderTable()
    const table = screen.getByRole('table')
    expect(within(table).getByText('Chair')).toBeInTheDocument()
    expect(screen.getByText('1–1 of 1')).toBeInTheDocument()
  })

  it('reports sort requests and exposes aria-sort', async () => {
    const { onSort } = renderTable({ sort: { key: 'name', direction: 'asc' } })
    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute('aria-sort', 'ascending')
    await userEvent.click(screen.getByRole('button', { name: /Name/ }))
    expect(onSort).toHaveBeenCalledWith('name')
  })

  it('shows the empty state', () => {
    renderTable({ page: page([]) })
    expect(screen.getByText('Nothing here')).toBeInTheDocument()
  })

  it('shows an error with a retry action', async () => {
    const { onRetry } = renderTable({ page: undefined, error: new Error('boom') })
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalled()
  })

  it('pages forward', async () => {
    const { onPageChange } = renderTable({
      page: page([{ id: 1, name: 'Chair', qty: 4 }], { totalElements: 45, totalPages: 3 }),
    })
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(onPageChange).toHaveBeenCalledWith(1)
  })
})
