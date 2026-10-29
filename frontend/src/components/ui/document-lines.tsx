import type { ReactNode } from 'react'

import { formatMoney } from '@/lib/format'

export interface DocumentLine {
  key: string | number
  lineNo: number
  description: ReactNode
  quantity: number
  unitPrice: number
  discountPercent: number
  taxRate: number
  lineSubtotal: number
}

/** Line table + totals shared by orders and invoices so both read identically. */
export function DocumentLines({
  lines,
  currency,
  totals,
}: {
  lines: DocumentLine[]
  currency: string
  totals: [string, number, 'strong' | 'normal' | 'accent'][]
}) {
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-xs text-muted-foreground">
              <th scope="col" className="h-9 w-10 px-3 text-left font-medium">#</th>
              <th scope="col" className="px-3 text-left font-medium">Description</th>
              <th scope="col" className="px-3 text-right font-medium">Qty</th>
              <th scope="col" className="px-3 text-right font-medium">Unit price</th>
              <th scope="col" className="px-3 text-right font-medium">Disc.</th>
              <th scope="col" className="px-3 text-right font-medium">Tax</th>
              <th scope="col" className="px-3 text-right font-medium">Net amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.key} className="border-b border-border last:border-0">
                <td className="px-3 py-2.5 text-muted-foreground tabular">{l.lineNo}</td>
                <td className="px-3 py-2.5">{l.description}</td>
                <td className="px-3 py-2.5 text-right tabular">{l.quantity}</td>
                <td className="px-3 py-2.5 text-right tabular">{formatMoney(l.unitPrice, currency)}</td>
                <td className="px-3 py-2.5 text-right tabular">{Number(l.discountPercent) ? `${Number(l.discountPercent)}%` : '—'}</td>
                <td className="px-3 py-2.5 text-right tabular">{Number(l.taxRate)}%</td>
                <td className="px-3 py-2.5 text-right font-medium tabular">{formatMoney(l.lineSubtotal, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end border-t border-border px-5 py-4">
        <dl className="w-full max-w-xs space-y-1.5 text-sm">
          {totals.map(([label, value, weight]) => (
            <div
              key={label}
              className={
                weight === 'strong'
                  ? 'flex justify-between border-t border-border pt-1.5 font-semibold'
                  : weight === 'accent'
                    ? 'flex justify-between text-base font-semibold text-primary'
                    : 'flex justify-between'
              }
            >
              <dt className={weight === 'normal' ? 'text-muted-foreground' : undefined}>{label}</dt>
              <dd className="tabular">{formatMoney(value, currency)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </>
  )
}
