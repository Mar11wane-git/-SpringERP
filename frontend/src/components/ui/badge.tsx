import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'

import { cn } from '@/lib/utils'
import { humanize } from '@/lib/format'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'bg-secondary text-secondary-foreground',
        info: 'bg-info-soft text-accent-foreground',
        success: 'bg-success-soft text-success',
        warning: 'bg-warning-soft text-warning',
        danger: 'bg-danger-soft text-destructive',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>['tone']>

export function Badge({ className, tone, ...props }: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />
}

/** Status values used across modules, mapped once so every page labels them the same way. */
const STATUS_TONES: Record<string, BadgeTone> = {
  ACTIVE: 'success',
  APPROVED: 'success',
  PAID: 'success',
  COMPLETED: 'success',
  CONFIRMED: 'info',
  ISSUED: 'info',
  PENDING: 'warning',
  PARTIALLY_PAID: 'warning',
  ON_LEAVE: 'warning',
  DRAFT: 'neutral',
  SUSPENDED: 'warning',
  OVERDUE: 'danger',
  REJECTED: 'danger',
  TERMINATED: 'neutral',
  CANCELLED: 'neutral',
  INACTIVE: 'neutral',
  LOCKED: 'danger',
  LOW_STOCK: 'danger',
}

const STATUS_LABELS: Record<string, string> = { DRAFT: 'Draft / quote', PARTIALLY_PAID: 'Partially paid' }

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const tone = STATUS_TONES[status] ?? 'neutral'
  return (
    <Badge tone={tone} className={className}>
      <span
        aria-hidden
        className={cn(
          'size-1.5 rounded-full',
          tone === 'success' && 'bg-success',
          tone === 'info' && 'bg-primary',
          tone === 'warning' && 'bg-warning',
          tone === 'danger' && 'bg-destructive',
          tone === 'neutral' && 'bg-subtle-foreground',
        )}
      />
      {STATUS_LABELS[status] ?? humanize(status)}
    </Badge>
  )
}
