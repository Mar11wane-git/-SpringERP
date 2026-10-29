import { useMutation, useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { ChartLegend, ChartTooltip, ViewToggle, axisProps, type SeriesDef } from '@/components/charts/chart-parts'
import { DateRangePicker, presetRange, type DateRange } from '@/components/charts/date-range'
import { PageHeader } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback'
import { useAuth } from '@/features/auth/auth-context'
import { api } from '@/lib/api'
import { formatCompactMoney, formatMoney, formatMonth, formatNumber } from '@/lib/format'
import { handleMutationError } from '@/lib/mutations'
import { cn } from '@/lib/utils'
import type { HrReport, InventoryReport, SalesReport } from '@/types/api'

const SALES_SERIES: SeriesDef[] = [
  { key: 'invoiced', label: 'Invoiced', color: 'var(--chart-1)' },
  { key: 'collected', label: 'Collected', color: 'var(--chart-2)' },
]

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-xl font-semibold tracking-tight">{value}</p>
    </Card>
  )
}

function ExportButton({ path, params }: { path: string; params?: Record<string, string> }) {
  const download = useMutation({ mutationFn: () => api.download(path, params), onError: (e) => handleMutationError(e) })
  return (
    <Button variant="secondary" size="sm" onClick={() => download.mutate()} loading={download.isPending}>
      <Download />
      CSV
    </Button>
  )
}

function SalesTab() {
  const [range, setRange] = useState<DateRange>(() => presetRange('ytd'))
  const [view, setView] = useState<'chart' | 'table'>('chart')
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['reports', 'sales', range],
    queryFn: () => api.get<SalesReport>('/api/reports/sales', { ...range }),
    placeholderData: (p) => p,
  })
  const c = data?.currency ?? 'EUR'
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateRangePicker value={range} onChange={setRange} initialPreset="ytd" />
        <ExportButton path="/api/reports/sales/export" params={{ ...range }} />
      </div>
      {isLoading && <Skeleton className="h-80" />}
      {error && !data && <ErrorState error={error} onRetry={() => void refetch()} />}
      {data && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <Kpi label="Orders booked" value={formatMoney(data.booked, c)} />
            <Kpi label="Invoiced" value={formatMoney(data.invoiced, c)} />
            <Kpi label="Collected" value={formatMoney(data.collected, c)} />
            <Kpi label="Purchases (stock received)" value={formatMoney(data.purchases, c)} />
            <Kpi label="Outstanding today" value={formatMoney(data.outstanding, c)} />
          </div>
          <Card>
            <CardHeader title="Invoiced vs collected by month" action={<ViewToggle value={view} onChange={setView} />} />
            <CardBody>
              {view === 'chart' ? (
                <>
                  <ChartLegend series={SALES_SERIES} />
                  <div className="mt-3 h-72" role="img" aria-label="Bar chart of invoiced and collected amounts per month">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.months} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2}>
                        <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                        <XAxis dataKey="month" tickFormatter={formatMonth} {...axisProps} />
                        <YAxis width={56} tickFormatter={(v: number) => formatCompactMoney(v, c)} {...axisProps} />
                        <Tooltip
                          cursor={{ fill: 'var(--muted)' }}
                          content={(p) => (
                            <ChartTooltip active={p.active} payload={p.payload as never} label={p.label as string} series={SALES_SERIES} formatValue={(v) => formatMoney(v, c)} formatLabel={formatMonth} />
                          )}
                        />
                        {SALES_SERIES.map((s) => (
                          <Bar key={s.key} dataKey={s.key} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground">
                        <th scope="col" className="py-2 text-left font-medium">Month</th>
                        <th scope="col" className="py-2 text-right font-medium">Orders</th>
                        <th scope="col" className="py-2 text-right font-medium">Booked</th>
                        <th scope="col" className="py-2 text-right font-medium">Invoiced</th>
                        <th scope="col" className="py-2 text-right font-medium">Collected</th>
                        <th scope="col" className="py-2 text-right font-medium">Purchases</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.months.map((m) => (
                        <tr key={m.month} className="border-b border-border last:border-0">
                          <td className="py-2">{formatMonth(m.month)}</td>
                          <td className="py-2 text-right tabular">{m.orders}</td>
                          <td className="py-2 text-right tabular">{formatMoney(m.booked, c)}</td>
                          <td className="py-2 text-right tabular">{formatMoney(m.invoiced, c)}</td>
                          <td className="py-2 text-right tabular">{formatMoney(m.collected, c)}</td>
                          <td className="py-2 text-right tabular">{formatMoney(m.purchases, c)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Top products by net revenue" description="Confirmed and completed orders in the period" />
            {data.topProducts.length === 0 ? (
              <EmptyState title="No sales in this period" />
            ) : (
              <ol className="border-t border-border">
                {data.topProducts.map((p, i) => {
                  const max = Number(data.topProducts[0]?.revenue ?? 1) || 1
                  return (
                    <li key={p.productId} className="grid grid-cols-[1.5rem_1fr_auto] items-center gap-3 border-b border-border px-5 py-2.5 last:border-0">
                      <span className="text-xs text-muted-foreground tabular">{i + 1}</span>
                      <div className="min-w-0">
                        <Link to={`/inventory/products/${p.productId}`} className="block truncate text-sm hover:underline">{p.name}</Link>
                        <div className="mt-1 h-1 rounded-full bg-muted">
                          <div className="h-1 rounded-full bg-chart-1" style={{ width: `${(Number(p.revenue) / max) * 100}%` }} />
                        </div>
                      </div>
                      <span className="text-right text-sm tabular">
                        {formatMoney(p.revenue, c)}
                        <span className="block text-xs text-muted-foreground">{formatNumber(p.quantity)} units</span>
                      </span>
                    </li>
                  )
                })}
              </ol>
            )}
          </Card>
        </>
      )}
    </div>
  )
}

function InventoryTab() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['reports', 'inventory'], queryFn: () => api.get<InventoryReport>('/api/reports/inventory') })
  if (isLoading) return <Skeleton className="h-80" />
  if (error || !data) return <ErrorState error={error} onRetry={() => void refetch()} />
  const c = data.currency
  const max = Math.max(1, ...data.byCategory.map((x) => Number(x.valueAtCost)))
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <ExportButton path="/api/reports/inventory/export" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Kpi label="Stock value at cost" value={formatMoney(data.valueAtCost, c)} />
        <Kpi label="Stock value at selling price" value={formatMoney(data.valueAtPrice, c)} />
        <Kpi label="Products at or below reorder level" value={formatNumber(data.lowStockCount)} />
      </div>
      <Card>
        <CardHeader title="Value at cost by category" />
        <CardBody>
          {data.byCategory.length === 0 ? (
            <EmptyState title="No active products" />
          ) : (
            <ul className="space-y-3">
              {data.byCategory.map((cat) => (
                <li key={cat.category}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{cat.category} <span className="text-xs text-muted-foreground">· {cat.products} products, {formatNumber(cat.units)} units</span></span>
                    <span className="font-medium tabular">{formatMoney(cat.valueAtCost, c)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted">
                    <div className="h-1.5 rounded-full bg-chart-1" style={{ width: `${(Number(cat.valueAtCost) / max) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
      <Card className="overflow-hidden">
        <CardHeader title="Valuation by product" />
        <div className="overflow-x-auto border-t border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-xs text-muted-foreground">
                <th scope="col" className="h-9 px-4 text-left font-medium">Product</th>
                <th scope="col" className="px-4 text-left font-medium">Category</th>
                <th scope="col" className="px-4 text-right font-medium">On hand</th>
                <th scope="col" className="px-4 text-right font-medium">Value at cost</th>
              </tr>
            </thead>
            <tbody>
              {data.lines.map((l) => (
                <tr key={l.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2"><Link to={`/inventory/products/${l.id}`} className="hover:underline">{l.name}</Link> <span className="text-xs text-muted-foreground">{l.sku}</span></td>
                  <td className="px-4 py-2 text-muted-foreground">{l.category}</td>
                  <td className={cn('px-4 py-2 text-right tabular', l.lowStock && 'font-medium text-warning')}>{formatNumber(l.quantityOnHand)} {l.unit}</td>
                  <td className="px-4 py-2 text-right tabular">{formatMoney(l.valueAtCost, c)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function HrTab() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['reports', 'hr'], queryFn: () => api.get<HrReport>('/api/reports/hr') })
  if (isLoading) return <Skeleton className="h-64" />
  if (error || !data) return <ErrorState error={error} onRetry={() => void refetch()} />
  const max = Math.max(1, ...data.headcountByDepartment.map((d) => d.employees))
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Kpi label="Headcount (excl. terminated)" value={formatNumber(data.totalHeadcount)} />
      <Card className="lg:col-span-2">
        <CardHeader title="Headcount by department" />
        <CardBody>
          {data.headcountByDepartment.length === 0 ? (
            <EmptyState title="No employees yet" />
          ) : (
            <ul className="space-y-3">
              {data.headcountByDepartment.map((d) => (
                <li key={d.department}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{d.department}</span>
                    <span className="font-medium tabular">{d.employees}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted">
                    <div className="h-1.5 rounded-full bg-chart-1" style={{ width: `${(d.employees / max) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  )
}

type Tab = 'sales' | 'inventory' | 'hr'

export default function ReportsPage() {
  const { can } = useAuth()
  const tabs: { id: Tab; label: string; allowed: boolean }[] = [
    { id: 'sales', label: 'Sales & cash', allowed: can('REPORT_FINANCIAL') },
    { id: 'inventory', label: 'Inventory', allowed: can('REPORT_READ', 'INVENTORY_READ') },
    { id: 'hr', label: 'People', allowed: can('REPORT_READ', 'EMPLOYEE_READ') },
  ]
  const allowed = tabs.filter((t) => t.allowed)
  const [tab, setTab] = useState<Tab | undefined>(allowed[0]?.id)

  return (
    <>
      <PageHeader title="Reports" description="Figures computed from recorded transactions. Export any report as CSV." />
      {allowed.length === 0 ? (
        <EmptyState title="No reports available for your role" />
      ) : (
        <>
          <div role="tablist" aria-label="Report" className="mb-6 flex gap-1 border-b border-border">
            {allowed.map((t) => (
              <button
                key={t.id}
                role="tab"
                type="button"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                  tab === t.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div role="tabpanel">
            {tab === 'sales' && <SalesTab />}
            {tab === 'inventory' && <InventoryTab />}
            {tab === 'hr' && <HrTab />}
          </div>
        </>
      )}
    </>
  )
}
