import { describe, expect, it } from 'vitest'

import { previewLine, previewTotals, toHundredths } from './pricing'

// Same cases as backend PricingTest: the preview must match the server to the cent.
describe('order pricing preview', () => {
  it('parses decimal strings without floating-point error', () => {
    expect(toHundredths('19.99')).toBe(1999)
    expect(toHundredths('0.1')).toBe(10)
    expect(toHundredths('20')).toBe(2000)
    expect(toHundredths('1.005')).toBe(101) // half-up on the third decimal
    expect(toHundredths('abc')).toBe(0)
  })

  it('computes a line with discount and tax like Pricing.java', () => {
    const line = previewLine(3, '19.99', '10', 20)
    expect(line).toEqual({ gross: 5997, discount: 600, net: 5397, tax: 1079, total: 6476 })
  })

  it('rounds exact halves up', () => {
    // 0.25 x 10% = 0.025 -> 0.03
    expect(previewLine(1, '0.25', '0', 10).tax).toBe(3)
  })

  it('sums rounded lines into document totals', () => {
    const totals = previewTotals([previewLine(4, '25.00', '10', 20)])
    expect(totals).toEqual({ subtotal: 10000, discount: 1000, tax: 1800, total: 10800 })
  })

  it('ignores invalid quantities', () => {
    expect(previewLine(0, '10', '0', 20).total).toBe(0)
    expect(previewLine(1.5, '10', '0', 20).total).toBe(0)
  })
})
