import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export interface SeriesDef {
  key: string
  label: string
  /** CSS variable holding the validated series colour, e.g. var(--chart-1). */
  color: string
}

/** Legend for multi-series charts; identity is never conveyed by colour alone. */
export function ChartLegend({ series }: { series: SeriesDef[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span className="h-0.5 w-3.5 rounded-full" style={{ background: s.color }} aria-hidden />
          {s.label}
        </li>
      ))}
    </ul>
  )
}

interface TooltipEntry {
  dataKey?: string | number
  value?: number | string
  color?: string
}

/** Tooltip card in UI tokens; values are written in text ink, the swatch carries identity. */
export function ChartTooltip({
  active,
  payload,
  label,
  series,
  formatValue,
  formatLabel,
}: {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string | number
  series: SeriesDef[]
  formatValue: (v: number) => string
  formatLabel?: (l: string) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="min-w-44 rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="mb-1.5 font-medium text-foreground">{formatLabel ? formatLabel(String(label)) : label}</p>
      <ul className="space-y-1">
        {series.map((s) => {
          const entry = payload.find((p) => p.dataKey === s.key)
          if (!entry) return null
          return (
            <li key={s.key} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="size-2 rounded-full" style={{ background: s.color }} aria-hidden />
                {s.label}
              </span>
              <span className="font-medium text-foreground tabular">{formatValue(Number(entry.value ?? 0))}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function ViewToggle({ value, onChange }: { value: 'chart' | 'table'; onChange: (v: 'chart' | 'table') => void }) {
  const option = (v: 'chart' | 'table', label: ReactNode) => (
    <button
      type="button"
      aria-pressed={value === v}
      onClick={() => onChange(v)}
      className={cn(
        'rounded px-2 py-0.5 text-xs font-medium transition-colors',
        value === v ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </button>
  )
  return (
    <div className="inline-flex rounded-md bg-muted p-0.5" role="group" aria-label="View">
      {option('chart', 'Chart')}
      {option('table', 'Table')}
    </div>
  )
}

export const axisProps = {
  tick: { fill: 'var(--chart-axis)', fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const
