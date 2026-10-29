import { describe, expect, it } from 'vitest'

import { formatDate, formatMoney, humanize, isoDate, percentChange } from './format'

describe('format helpers', () => {
  it('shows business dates without time-zone shifting', () => {
    // A naive new Date('2026-01-01') would render 31 Dec in negative-offset zones.
    expect(formatDate('2026-01-01')).toBe('01 Jan 2026')
    expect(formatDate(null)).toBe('—')
  })

  it('formats money with two decimals and the currency', () => {
    expect(formatMoney(1234.5, 'EUR')).toBe('€1,234.50')
    expect(formatMoney(null)).toBe('—')
  })

  it('reports no percentage change without a baseline', () => {
    expect(percentChange(100, 0)).toBeNull()
    expect(percentChange(150, 100)).toBe(50)
    expect(percentChange(50, 100)).toBe(-50)
  })

  it('builds local yyyy-mm-dd dates', () => {
    expect(isoDate(new Date(2026, 2, 7))).toBe('2026-03-07')
  })

  it('humanizes enum values', () => {
    expect(humanize('PARTIALLY_PAID')).toBe('Partially paid')
  })
})
