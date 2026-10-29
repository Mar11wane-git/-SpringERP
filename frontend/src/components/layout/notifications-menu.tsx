import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { api } from '@/lib/api'
import { formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { AppNotification, Page } from '@/types/api'

export function NotificationsMenu() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { data: unread } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api.get<{ count: number }>('/api/notifications/unread-count'),
    refetchInterval: 60_000,
  })
  const { data: list, isLoading } = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => api.get<Page<AppNotification>>('/api/notifications', { size: 8 }),
  })
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['notifications'] })
  const markRead = useMutation({ mutationFn: (id: number) => api.post(`/api/notifications/${id}/read`), onSuccess: invalidate })
  const markAll = useMutation({ mutationFn: () => api.post('/api/notifications/read-all'), onSuccess: invalidate })
  const count = unread?.count ?? 0

  return (
    <DropdownMenu onOpenChange={(open) => open && invalidate()}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={count ? `Notifications, ${count} unread` : 'Notifications'} className="relative">
          <Bell />
          {count > 0 && (
            <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white tabular">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[22rem] p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <p className="text-sm font-semibold">Notifications</p>
          <Button variant="ghost" size="sm" disabled={count === 0 || markAll.isPending} onClick={() => markAll.mutate()}>
            <CheckCheck />
            Mark all read
          </Button>
        </div>
        <ul className="max-h-96 overflow-y-auto">
          {isLoading && <li className="px-3 py-6 text-center text-sm text-muted-foreground">Loading…</li>}
          {!isLoading && list?.content.length === 0 && (
            <li className="px-3 py-8 text-center text-sm text-muted-foreground">You're all caught up.</li>
          )}
          {list?.content.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => {
                  if (!n.read) markRead.mutate(n.id)
                  if (n.link) navigate(n.link)
                }}
                className="flex w-full gap-3 border-b border-border px-3 py-2.5 text-left last:border-0 hover:bg-muted"
              >
                <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-primary')} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-[13px]', !n.read && 'font-semibold')}>
                    {n.title}
                    {!n.read && <span className="sr-only"> (unread)</span>}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{n.message}</span>
                  <span className="mt-1 block text-[11px] text-subtle-foreground">{formatRelative(n.createdAt)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
