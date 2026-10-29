import { NavLink } from 'react-router-dom'

import { useAuth } from '@/features/auth/auth-context'
import { cn } from '@/lib/utils'

import { NAV } from './nav'

export function Logo({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-[13px] font-bold text-primary-foreground">
        S
      </div>
      {!collapsed && <span className="text-[15px] font-semibold tracking-tight">SpringERP</span>}
    </div>
  )
}

/** Grouped navigation, filtered by what the signed-in user may access. */
export function SidebarNav({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const { can } = useAuth()
  return (
    <nav aria-label="Main" className="flex flex-col gap-5">
      {NAV.map((group) => {
        const items = group.items.filter((i) => !i.permissions || can(...i.permissions))
        if (items.length === 0) return null
        return (
          <div key={group.label}>
            {collapsed ? (
              <div className="mx-auto mb-2 h-px w-6 bg-border" aria-hidden />
            ) : (
              <p className="mb-1.5 px-2.5 text-[11px] font-medium tracking-wide text-subtle-foreground uppercase">
                {group.label}
              </p>
            )}
            <ul className="flex flex-col gap-0.5">
              {items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    onClick={onNavigate}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      cn(
                        'flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-colors',
                        collapsed && 'justify-center px-0',
                        isActive
                          ? 'bg-accent text-accent-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )
                    }
                  >
                    <item.icon className="size-4 shrink-0" aria-hidden />
                    {collapsed ? <span className="sr-only">{item.label}</span> : item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </nav>
  )
}
