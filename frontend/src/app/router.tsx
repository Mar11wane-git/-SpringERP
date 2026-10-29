import { lazy, type ComponentType, type ReactNode } from 'react'
import { createBrowserRouter, Link, type RouteObject } from 'react-router-dom'

import { AppShell, type RouteHandle } from '@/components/layout/app-shell'
import { EmptyState } from '@/components/ui/feedback'
import { RedirectIfAuthenticated, RequireAuth, RequirePermission } from '@/features/auth/guards'
import type { Permission } from '@/types/api'

// Each page is its own chunk, so the initial bundle stays small.
const page = (load: () => Promise<{ default: ComponentType }>) => lazy(load)
const LoginPage = page(() => import('@/features/auth/login-page'))
const ChangePasswordPage = page(() => import('@/features/auth/change-password-page'))
const ProfilePage = page(() => import('@/features/auth/profile-page'))
const DashboardPage = page(() => import('@/features/dashboard/dashboard-page'))
const ProductsPage = page(() => import('@/features/inventory/products-page'))
const ProductDetailPage = page(() => import('@/features/inventory/product-detail-page'))
const CategoriesPage = page(() => import('@/features/inventory/categories-page'))
const MovementsPage = page(() => import('@/features/inventory/movements-page'))
const OrdersPage = page(() => import('@/features/orders/orders-page'))
const OrderEditorPage = page(() => import('@/features/orders/order-editor-page'))
const OrderDetailPage = page(() => import('@/features/orders/order-detail-page'))
const InvoicesPage = page(() => import('@/features/invoices/invoices-page'))
const InvoiceDetailPage = page(() => import('@/features/invoices/invoice-detail-page'))
const EmployeesPage = page(() => import('@/features/employees/employees-page'))
const EmployeeDetailPage = page(() => import('@/features/employees/employee-detail-page'))
const DepartmentsPage = page(() => import('@/features/employees/departments-page'))
const LeavePage = page(() => import('@/features/leave/leave-page'))
const ReportsPage = page(() => import('@/features/reports/reports-page'))
const UsersPage = page(() => import('@/features/admin/users-page'))
const AuditPage = page(() => import('@/features/admin/audit-page'))
const CompanySettingsPage = page(() => import('@/features/admin/company-settings-page'))
const PartnersPage = lazy(() => import('@/features/partners/partners-page'))
const PartnerDetailPage = lazy(() => import('@/features/partners/partner-detail-page'))

function guard(permission: Permission | Permission[], element: ReactNode) {
  return <RequirePermission permission={permission}>{element}</RequirePermission>
}

function NotFound() {
  return (
    <EmptyState
      title="Page not found"
      description="The page you are looking for does not exist or was moved."
      action={
        <Link to="/" className="text-sm font-medium text-primary hover:underline">
          Back to dashboard
        </Link>
      }
      className="py-24"
    />
  )
}

const crumb = (label: string): RouteHandle => ({ crumb: label })

const appRoutes: RouteObject[] = [
  { index: true, element: guard('DASHBOARD_READ', <DashboardPage />), handle: crumb('Dashboard') },
  {
    path: 'inventory',
    handle: crumb('Inventory'),
    children: [
      {
        path: 'products',
        handle: crumb('Products'),
        children: [
          { index: true, element: guard('INVENTORY_READ', <ProductsPage />) },
          { path: ':id', element: guard('INVENTORY_READ', <ProductDetailPage />), handle: crumb('Product') },
        ],
      },
      { path: 'categories', element: guard('INVENTORY_READ', <CategoriesPage />), handle: crumb('Categories') },
      { path: 'movements', element: guard('INVENTORY_READ', <MovementsPage />), handle: crumb('Stock movements') },
    ],
  },
  {
    path: 'customers',
    handle: crumb('Customers'),
    children: [
      { index: true, element: guard('PARTNER_READ', <PartnersPage kind="customers" />) },
      { path: ':id', element: guard('PARTNER_READ', <PartnerDetailPage kind="customers" />), handle: crumb('Customer') },
    ],
  },
  {
    path: 'suppliers',
    handle: crumb('Suppliers'),
    children: [
      { index: true, element: guard('PARTNER_READ', <PartnersPage kind="suppliers" />) },
      { path: ':id', element: guard('PARTNER_READ', <PartnerDetailPage kind="suppliers" />), handle: crumb('Supplier') },
    ],
  },
  {
    path: 'sales/orders',
    handle: crumb('Orders'),
    children: [
      { index: true, element: guard('SALES_READ', <OrdersPage />) },
      { path: 'new', element: guard('SALES_WRITE', <OrderEditorPage />), handle: crumb('New quote') },
      { path: ':id', element: guard('SALES_READ', <OrderDetailPage />), handle: crumb('Order') },
      { path: ':id/edit', element: guard('SALES_WRITE', <OrderEditorPage />), handle: crumb('Edit') },
    ],
  },
  {
    path: 'invoices',
    handle: crumb('Invoices'),
    children: [
      { index: true, element: guard('INVOICE_READ', <InvoicesPage />) },
      { path: ':id', element: guard('INVOICE_READ', <InvoiceDetailPage />), handle: crumb('Invoice') },
    ],
  },
  {
    path: 'employees',
    handle: crumb('Employees'),
    children: [
      { index: true, element: guard('EMPLOYEE_READ', <EmployeesPage />) },
      { path: ':id', element: guard('EMPLOYEE_READ', <EmployeeDetailPage />), handle: crumb('Employee') },
    ],
  },
  { path: 'departments', element: <DepartmentsPage />, handle: crumb('Departments') },
  { path: 'leave', element: <LeavePage />, handle: crumb('Leave') },
  { path: 'reports', element: guard('REPORT_READ', <ReportsPage />), handle: crumb('Reports') },
  { path: 'admin/users', element: guard('USER_READ', <UsersPage />), handle: crumb('Users') },
  { path: 'admin/audit', element: guard('AUDIT_READ', <AuditPage />), handle: crumb('Audit log') },
  { path: 'settings/company', element: guard('COMPANY_WRITE', <CompanySettingsPage />), handle: crumb('Company settings') },
  { path: 'profile', element: <ProfilePage />, handle: crumb('My account') },
  { path: '*', element: <NotFound /> },
]

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <RedirectIfAuthenticated>
        <LoginPage />
      </RedirectIfAuthenticated>
    ),
  },
  {
    element: <RequireAuth />,
    children: [
      { path: '/change-password', element: <ChangePasswordPage /> },
      { path: '/', element: <AppShell />, children: appRoutes },
    ],
  },
])
