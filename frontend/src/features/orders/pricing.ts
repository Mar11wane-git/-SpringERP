// Client-side preview of Pricing.java, computed in integer cents with the same
// HALF_UP rounding at line level. Display only: the server recomputes and is authoritative.

/** Parses a decimal string ("12.5", "0.07") into integer hundredths without floating-point error. */
export function toHundredths(value: string | number): number {
  const s = String(value).trim()
  if (!/^\d+(\.\d+)?$/.test(s)) return 0
  const [int = '0', frac = ''] = s.split('.')
  const two = (frac + '00').slice(0, 2)
  const rest = frac.slice(2)
  let cents = Number(int) * 100 + Number(two)
  if (rest && Number(rest[0]) >= 5) cents += 1 // HALF_UP on the third decimal
  return cents
}

/** round(a * b / 10000) half-up, for cents x percent-in-hundredths. */
function percentOf(cents: number, percentHundredths: number): number {
  return Math.floor((cents * percentHundredths + 5000) / 10000)
}

export interface LinePreview {
  gross: number
  discount: number
  net: number
  tax: number
  total: number
}

export function previewLine(quantity: number, unitPrice: string, discountPercent: string, taxRate: number): LinePreview {
  const qty = Number.isInteger(quantity) && quantity > 0 ? quantity : 0
  const gross = toHundredths(unitPrice) * qty
  const discount = percentOf(gross, toHundredths(discountPercent || '0'))
  const net = gross - discount
  const tax = percentOf(net, toHundredths(taxRate))
  return { gross, discount, net, tax, total: net + tax }
}

export function previewTotals(lines: LinePreview[]) {
  const subtotal = lines.reduce((s, l) => s + l.gross, 0)
  const discount = lines.reduce((s, l) => s + l.discount, 0)
  const tax = lines.reduce((s, l) => s + l.tax, 0)
  return { subtotal, discount, tax, total: subtotal - discount + tax }
}

export const centsToNumber = (cents: number) => cents / 100
