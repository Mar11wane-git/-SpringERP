import { useState } from 'react'

import { Input, Select } from '@/components/ui/input'
import { isoDate } from '@/lib/format'

export interface DateRange {
  from: string
  to: string
}

type Preset = 'mtd' | '30d' | '90d' | 'qtd' | 'ytd' | 'custom'

const PRESETS: { value: Preset; label: string }[] = [
  { value: 'mtd', label: 'Month to date' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'qtd', label: 'Quarter to date' },
  { value: 'ytd', label: 'Year to date' },
  { value: 'custom', label: 'Custom range' },
]

export function presetRange(preset: Exclude<Preset, 'custom'>, today = new Date()): DateRange {
  const to = isoDate(today)
  const d = new Date(today)
  switch (preset) {
    case 'mtd':
      return { from: isoDate(new Date(d.getFullYear(), d.getMonth(), 1)), to }
    case '30d':
      d.setDate(d.getDate() - 29)
      return { from: isoDate(d), to }
    case '90d':
      d.setDate(d.getDate() - 89)
      return { from: isoDate(d), to }
    case 'qtd':
      return { from: isoDate(new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1)), to }
    case 'ytd':
      return { from: isoDate(new Date(d.getFullYear(), 0, 1)), to }
  }
}

/** Preset date ranges plus a custom from/to, in one row above the content it filters. */
export function DateRangePicker({ value, onChange, initialPreset = 'mtd' }: {
  value: DateRange
  onChange: (range: DateRange) => void
  initialPreset?: Preset
}) {
  const [preset, setPreset] = useState<Preset>(initialPreset)
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        aria-label="Date range"
        value={preset}
        onChange={(e) => {
          const p = e.target.value as Preset
          setPreset(p)
          if (p !== 'custom') onChange(presetRange(p))
        }}
        className="h-8 w-auto text-[13px]"
      >
        {PRESETS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </Select>
      {preset === 'custom' && (
        <>
          <Input
            type="date"
            aria-label="From"
            value={value.from}
            max={value.to}
            onChange={(e) => e.target.value && onChange({ ...value, from: e.target.value })}
            className="h-8 w-auto text-[13px]"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="date"
            aria-label="To"
            value={value.to}
            min={value.from}
            onChange={(e) => e.target.value && onChange({ ...value, to: e.target.value })}
            className="h-8 w-auto text-[13px]"
          />
        </>
      )}
    </div>
  )
}
