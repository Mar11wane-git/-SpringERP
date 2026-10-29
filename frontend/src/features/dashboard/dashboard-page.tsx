import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  Building2,
  CalendarClock,
  ClipboardList,
  FileText,
  Minus,
  UserSquare2,
  type LucideIcon,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { ChartLegend, ChartTooltip, ViewToggle, axisProps, type SeriesDef } from '@/components/charts/chart-parts'
import { DateRangePicker, presetRange, type DateRange } from '@/components/charts/date-range'
import { PageHeader } from '@/components/layout/app-shell'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback'
import { useAuth } from '@/features/auth/auth-context'
import { api } from '@/lib/api'
import {
  formatCompactMoney,
  formatDate,
  formatMoney,
  formatMonth,
  formatNumber,
  formatRelative,
  humanize,
  percentChange,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import { ORDER_STATUSES, type Dashboard, type Metric } from '@/types/api'

const TREND_SERIES: SeriesDef[] = [
  { key: 'invoiced', label: 'Invoiced', color: 'var(--chart-1)' },
  { key: 'collected', label: 'Collected', color: 'var(--chart-2)' },
  { key: 'purchases', label: 'Purchases', color: 'var(--chart-3)' },
]

function StatTile({ label, value, icon: Icon, to }: { label: string; value: number; icon: LucideIcon; to: string }) {
  return (
    <Link to={to} className="group rounded-lg border border-border bg-card p-4 shadow-xs transition-colors hover:border-input">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <Icon className="size-4 text-subtle-foreground group-hover:text-muted-foreground" aria-hidden />
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{formatNumber(value)}</p>
    </Link>
  )
}

/** Change vs. the previous equal-length period; neutral wording when there is no baseline. */
function Delta({ metric, positiveIsGood = true }: { metric: Metric; positiveIsGood?: boolean }) {
  const change = percentChange(Number(metric.current), Number(metric.previous))
  if (change === null) {
    return <span className="text-xs text-muted-foreground">No data in previous period</span>
  }
  const up = change > 0.05
  const down = change < -0.05
  const good = (up && positiveIsGood) || (down && !positiveIsGood)
  const bad = (down && positiveIsGood) || (up && !positiveIsGood)
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-xs font-medium', good && 'text-success', bad && 'text-destructive', !good && !bad && 'text-muted-foreground')}>
      <Icon className="size-3.5" aria-hidden />
      {Math.abs(change).toFixed(1)}%<span className="ml-1 font-normal text-muted-foreground">vs previous period</span>
    </span>
  )
}

function MoneyTile({ label, value, currency, footer }: { label: string; value: number; currency: string; footer: ReactNode }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{formatMoney(value, currency)}</p>
      <div className="mt-1.5">{footer}</div>
    </Card>
  )
}

function TrendCard({ data, currency }: { data: NonNullable<Dashboard['trend']>; currency: string }) {
  const [view, setView] = useState<'chart' | 'table'>('chart')
  const empty = data.every((d) => !Number(d.invoiced) && !Number(d.collected) && !Number(d.purchases))
  return (
    <Card className="lg:col-span-2">
      <CardHeader
        title="Cash flow, last 6 months"
        description="Invoiced and collected amounts, and the cost of goods received from suppliers"
        action={<ViewToggle value={view} onChange={setView} />}
      />
      <CardBody>
        {empty ? (
          <EmptyState title="No activity yet" description="Figures appear once invoices, payments or stock receipts are recorded." />
        ) : view === 'chart' ? (
          <>
            <ChartLegend series={TREND_SERIES} />
            <div className="mt-3 h-64" role="img" aria-label="Line chart of invoiced, collected and purchases per month">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                  <XAxis dataKey="month" tickFormatter={formatMonth} {...axisProps} />
                  <YAxis width={56} tickFormatter={(v: number) => formatCompactMoney(v, currency)} {...axisProps} />
                  <Tooltip
                    cursor={{ stroke: 'var(--chart-axis)', strokeDasharray: '3 3' }}
                    content={(p) => (
                      <ChartTooltip
                        active={p.active}
                        payload={p.payload as never}
                        label={p.label as string}
                        series={TREND_SERIES}
                        formatValue={(v) => formatMoney(v, currency)}
                        formatLabel={formatMonth}
                      />
                    )}
                  />
                  {TREND_SERIES.map((s) => (
                    <Line
                      key={s.key}
                      type="monotone"
                      dataKey={s.key}
                      stroke={s.color}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--card)' }}
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Monthly invoiced, collected and purchases</caption>
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th scope="col" className="py-2 text-left font-medium">Month</th>
                  {TREND_SERIES.map((s) => (
                    <th key={s.key} scope="col" className="py-2 text-right font-medium">{s.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.month} className="border-b border-border last:border-0">
                    <td className="py-2">{formatMonth(row.month)}</td>
                    <td className="py-2 text-right tabular">{formatMoney(row.invoiced, currency)}</td>
                    <td className="py-2 text-right tabular">{formatMoney(row.collected, currency)}</td>
                    <td className="py-2 text-right tabular">{formatMoney(row.purchases, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  )
}

function OrdersByStatus({ counts }: { counts: NonNullable<Dashboard['ordersByStatus']> }) {
  const max = Math.max(1, ...ORDER_STATUSES.map((s) => counts[s] ?? 0))
  return (
    <Card>
      <CardHeader title="Orders by status" description="All time" action={<Link to="/sales/orders" className="text-xs text-primary hover:underline">View orders</Link>} />
      <CardBody>
        <ul className="space-y-3">
          {ORDER_STATUSES.map((s) => {
            const n = counts[s] ?? 0
            return (
              <li key={s}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{s === 'DRAFT' ? 'Draft / quote' : humanize(s)}</span>
                  <span className="font-medium tabular">{formatNumber(n)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted">
                  <div className="h-1.5 rounded-full bg-chart-1" style={{ width: `${(n / max) * 100}%` }} />
                </div>
              </li>
            )
          })}
        </ul>
      </CardBody>
    </Card>
  )
}

function ListCard({ title, description, action, children }: { title: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Card className="flex flex-col">
      <CardHeader title={title} description={description} action={action} />
      <div className="flex-1 border-t border-border">{children}</div>
    </Card>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy aria-label="Loading dashboard">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
      <Skeleton className="h-80" />
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [range, setRange] = useState<DateRange>(() => presetRange('mtd'))
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard', range],
    queryFn: () => api.get<Dashboard>('/api/dashboard', { from: range.from, to: range.to }),
    placeholderData: (prev) => prev,
  })

  const firstName = user?.fullName.split(' ')[0]
  const fin = data?.financial
  const currency = fin?.currency ?? 'EUR'

  return (
    <>
      <PageHeader
        title={`Welcome back${firstName ? `, ${firstName}` : ''}`}
        description={data ? `${formatDate(data.from)} – ${formatDate(data.to)}, compared with ${formatDate(data.previousFrom)} – ${formatDate(data.previousTo)}` : 'Business overview'}
        actions={<DateRangePicker value={range} onChange={setRange} />}
      />

      {isLoading && <DashboardSkeleton />}
      {error && !data && (
        <Card>
          <ErrorState error={error} onRetry={() => void refetch()} />
        </Card>
      )}

      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
            {data.counts.employees !== undefined && <StatTile label="Active employees" value={data.counts.employees} icon={UserSquare2} to="/employees" />}
            {data.counts.products !== undefined && <StatTile label="Active products" value={data.counts.products} icon={Boxes} to="/inventory/products" />}
            {data.counts.customers !== undefined && <StatTile label="Active customers" value={data.counts.customers} icon={Building2} to="/customers" />}
            {data.counts.openOrders !== undefined && <StatTile label="Open orders" value={data.counts.openOrders} icon={ClipboardList} to="/sales/orders" />}
            {data.counts.openInvoices !== undefined && <StatTile label="Open invoices" value={data.counts.openInvoices} icon={FileText} to="/invoices" />}
          </div>

          {fin && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MoneyTile label="Invoiced" value={fin.invoiced.current} currency={currency} footer={<Delta metric={fin.invoiced} />} />
              <MoneyTile label="Collected" value={fin.collected.current} currency={currency} footer={<Delta metric={fin.collected} />} />
              <MoneyTile label="Purchases (stock received)" value={fin.purchases.current} currency={currency} footer={<Delta metric={fin.purchases} positiveIsGood={false} />} />
              <MoneyTile
                label="Outstanding receivables"
                value={fin.outstanding}
                currency={currency}
                footer={
                  fin.overdueCount > 0 ? (
                    <Link to="/invoices?overdue=true" className="inline-flex items-center gap-1 text-xs font-medium text-destructive hover:underline">
                      <AlertTriangle className="size-3.5" aria-hidden />
                      {fin.overdueCount} overdue invoice{fin.overdueCount > 1 ? 's' : ''}
                    </Link>
                  ) : (
                    <span className="text-xs text-muted-foreground">Nothing overdue</span>
                  )
                }
              />
            </div>
          )}

          {(data.trend || data.ordersByStatus) && (
            <div className="grid gap-4 lg:grid-cols-3">
              {data.trend && <TrendCard data={data.trend} currency={currency} />}
              {data.ordersByStatus && <OrdersByStatus counts={data.ordersByStatus} />}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {data.pendingLeaveRequests !== undefined && (
              <ListCard title="Pending approvals" description="Leave requests waiting for a decision">
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-md bg-warning-soft p-2">
                      <CalendarClock className="size-4 text-warning" aria-hidden />
                    </div>
                    <p className="text-sm">
                      <span className="text-lg font-semibold tabular">{data.pendingLeaveRequests}</span> request
                      {data.pendingLeaveRequests === 1 ? '' : 's'} to review
                    </p>
                  </div>
                  <Link to="/leave" className="text-xs font-medium text-primary hover:underline">Review</Link>
                </div>
              </ListCard>
            )}

            {data.lowStock && (
              <ListCard
                title="Low stock"
                description={`${data.lowStockCount ?? 0} product${data.lowStockCount === 1 ? '' : 's'} at or below reorder level`}
                action={<Link to="/inventory/products?lowStock=true" className="text-xs text-primary hover:underline">View all</Link>}
              >
                {data.lowStock.length === 0 ? (
                  <EmptyState title="Stock levels are healthy" className="py-8" />
                ) : (
                  <ul>
                    {data.lowStock.map((p) => (
                      <li key={p.id} className="border-b border-border last:border-0">
                        <Link to={`/inventory/products/${p.id}`} className="flex items-center justify-between gap-3 px-5 py-2.5 hover:bg-muted/60">
                          <span className="min-w-0">
                            <span className="block truncate text-sm">{p.name}</span>
                            <span className="block text-xs text-muted-foreground">{p.sku}</span>
                          </span>
                          <span className="text-right text-xs">
                            <span className={cn('block font-semibold tabular', p.quantityOnHand === 0 ? 'text-destructive' : 'text-warning')}>
                              {p.quantityOnHand} {p.unit}
                            </span>
                            <span className="text-muted-foreground">min {p.reorderLevel}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </ListCard>
            )}

            {data.overdueInvoices && (
              <ListCard
                title="Overdue invoices"
                description="Past their due date and not fully paid"
                action={<Link to="/invoices?overdue=true" className="text-xs text-primary hover:underline">View all</Link>}
              >
                {data.overdueInvoices.length === 0 ? (
                  <EmptyState title="No overdue invoices" className="py-8" />
                ) : (
                  <ul>
                    {data.overdueInvoices.map((i) => (
                      <li key={i.id} className="border-b border-border last:border-0">
                        <Link to={`/invoices/${i.id}`} className="flex items-center justify-between gap-3 px-5 py-2.5 hover:bg-muted/60">
                          <span className="min-w-0">
                            <span className="block truncate text-sm">{i.customer}</span>
                            <span className="block text-xs text-muted-foreground">{i.invoiceNumber} · due {formatDate(i.dueDate)}</span>
                          </span>
                          <span className="text-sm font-medium tabular">{formatMoney(i.balanceDue, i.currency)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </ListCard>
            )}

            {data.recentActivity && (
              <ListCard
                title="Recent activity"
                description="Latest audited actions"
                action={<Link to="/admin/audit" className="text-xs text-primary hover:underline">Audit log</Link>}
              >
                {data.recentActivity.length === 0 ? (
                  <EmptyState title="No activity recorded yet" className="py-8" />
                ) : (
                  <ul>
                    {data.recentActivity.slice(0, 7).map((e) => (
                      <li key={e.id} className="flex gap-3 border-b border-border px-5 py-2.5 last:border-0">
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-subtle-foreground" aria-hidden />
                        <span className="min-w-0">
                          <span className="block text-[13px] leading-snug">{e.summary}</span>
                          <span className="block text-xs text-muted-foreground">
                            {e.actorEmail ?? 'System'} · {formatRelative(e.occurredAt)}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </ListCard>
            )}
          </div>

          {!fin && !data.trend && !data.lowStock && !data.overdueInvoices && data.pendingLeaveRequests === undefined && (
            <Card>
              <EmptyState
                title="Your workspace"
                description="Use the navigation to request leave or browse the departments directory."
                action={<Link to="/leave" className="text-sm font-medium text-primary hover:underline">Go to my leave</Link>}
              />
            </Card>
          )}
        </div>
      )}
    </>
  )
}
