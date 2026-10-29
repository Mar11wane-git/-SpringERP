import * as DialogPrimitive from '@radix-ui/react-dialog'
import { ChevronRight, Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { Suspense, useState, type ReactNode } from 'react'
import { Link, Outlet, useMatches, type UIMatch } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/feedback'
import { cn, safeStorage } from '@/lib/utils'

import { CommandSearch } from './command-search'
import { NotificationsMenu } from './notifications-menu'
import { Logo, SidebarNav } from './sidebar'
import { ThemeToggle, UserMenu } from './user-menu'

export interface RouteHandle {
  crumb?: string
}

function Breadcrumbs() {
  const matches = useMatches() as UIMatch<unknown, RouteHandle>[]
  const crumbs = matches.filter((m) => m.handle?.crumb)
  if (crumbs.length === 0) return null
  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 md:block">
      <ol className="flex items-center gap-1 text-[13px] text-muted-foreground">
        {crumbs.map((m, i) => {
          const last = i === crumbs.length - 1
          return (
            <li key={m.id} className="flex min-w-0 items-center gap-1">
              {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-subtle-foreground" aria-hidden />}
              {last ? (
                <span aria-current="page" className="truncate font-medium text-foreground">
                  {m.handle.crumb}
                </span>
              ) : (
                <Link to={m.pathname} className="truncate hover:text-foreground">
                  {m.handle.crumb}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function PageFallback() {
  return (
    <div className="space-y-4" aria-busy>
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

export function AppShell() {
  const [collapsed, setCollapsed] = useState(() => safeStorage.get('sidebar-collapsed') === '1')
  const [mobileOpen, setMobileOpen] = useState(false)

  const toggle = () => {
    setCollapsed((c) => {
      safeStorage.set('sidebar-collapsed', c ? '0' : '1')
      return !c
    })
  }

  return (
    <div className="flex min-h-svh">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>

      <aside
        className={cn(
          'sticky top-0 hidden h-svh shrink-0 flex-col border-r border-border bg-sidebar transition-[width] duration-200 lg:flex',
          collapsed ? 'w-16' : 'w-60',
        )}
      >
        <div className={cn('flex h-14 items-center border-b border-border', collapsed ? 'justify-center' : 'px-4')}>
          <Logo collapsed={collapsed} />
        </div>
        <div className="flex-1 overflow-y-auto px-2.5 py-4">
          <SidebarNav collapsed={collapsed} />
        </div>
        <div className={cn('border-t border-border p-2', collapsed && 'flex justify-center')}>
          <Button variant="ghost" size={collapsed ? 'icon-sm' : 'sm'} onClick={toggle} className={cn(!collapsed && 'w-full justify-start')}>
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            {collapsed ? <span className="sr-only">Expand sidebar</span> : 'Collapse'}
          </Button>
        </div>
      </aside>

      <DialogPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/40 lg:hidden" />
          <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-border bg-sidebar shadow-lg animate-in lg:hidden">
            <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">Main navigation</DialogPrimitive.Description>
            <div className="flex h-14 items-center border-b border-border px-4">
              <Logo />
            </div>
            <div className="flex-1 overflow-y-auto px-2.5 py-4">
              <SidebarNav onNavigate={() => setMobileOpen(false)} />
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur no-print sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation" onClick={() => setMobileOpen(true)}>
            <Menu />
          </Button>
          <Breadcrumbs />
          <div className="ml-auto flex flex-1 items-center justify-end gap-1.5 md:flex-none">
            <div className="flex-1 md:w-72 md:flex-none">
              <CommandSearch />
            </div>
            <NotificationsMenu />
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:py-8">
          <Suspense fallback={<PageFallback />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  )
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
