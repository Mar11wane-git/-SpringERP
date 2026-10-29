import {
  Boxes,
  Building2,
  CalendarDays,
  ClipboardList,
  FileText,
  LayoutDashboard,
  ListTree,
  BarChart3,
  Settings,
  ShieldCheck,
  Truck,
  Users,
  UserSquare2,
  ArrowLeftRight,
  type LucideIcon,
} from 'lucide-react'

import type { Permission } from '@/types/api'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  /** All listed permissions are required to show the item. */
  permissions?: Permission[]
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const NAV: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ label: 'Dashboard', to: '/', icon: LayoutDashboard, permissions: ['DASHBOARD_READ'] }],
  },
  {
    label: 'Sales',
    items: [
      { label: 'Orders & quotes', to: '/sales/orders', icon: ClipboardList, permissions: ['SALES_READ'] },
      { label: 'Invoices', to: '/invoices', icon: FileText, permissions: ['INVOICE_READ'] },
      { label: 'Customers', to: '/customers', icon: Building2, permissions: ['PARTNER_READ'] },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { label: 'Products', to: '/inventory/products', icon: Boxes, permissions: ['INVENTORY_READ'] },
      { label: 'Stock movements', to: '/inventory/movements', icon: ArrowLeftRight, permissions: ['INVENTORY_READ'] },
      { label: 'Categories', to: '/inventory/categories', icon: ListTree, permissions: ['INVENTORY_READ'] },
      { label: 'Suppliers', to: '/suppliers', icon: Truck, permissions: ['PARTNER_READ'] },
    ],
  },
  {
    label: 'People',
    items: [
      { label: 'Employees', to: '/employees', icon: UserSquare2, permissions: ['EMPLOYEE_READ'] },
      { label: 'Departments', to: '/departments', icon: Building2 },
      { label: 'Leave', to: '/leave', icon: CalendarDays },
    ],
  },
  {
    label: 'Insights',
    items: [{ label: 'Reports', to: '/reports', icon: BarChart3, permissions: ['REPORT_READ'] }],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Users', to: '/admin/users', icon: Users, permissions: ['USER_READ'] },
      { label: 'Audit log', to: '/admin/audit', icon: ShieldCheck, permissions: ['AUDIT_READ'] },
      { label: 'Company settings', to: '/settings/company', icon: Settings, permissions: ['COMPANY_WRITE'] },
    ],
  },
]
