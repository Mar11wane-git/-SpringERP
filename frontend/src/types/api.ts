// Contracts mirrored from the backend DTOs (com.springerp.*Dtos). Keep in sync.

export type Permission =
  | 'DASHBOARD_READ'
  | 'USER_READ'
  | 'USER_WRITE'
  | 'AUDIT_READ'
  | 'COMPANY_WRITE'
  | 'EMPLOYEE_READ'
  | 'EMPLOYEE_WRITE'
  | 'LEAVE_APPROVE'
  | 'INVENTORY_READ'
  | 'INVENTORY_WRITE'
  | 'STOCK_ADJUST'
  | 'PARTNER_READ'
  | 'PARTNER_WRITE'
  | 'SALES_READ'
  | 'SALES_WRITE'
  | 'INVOICE_READ'
  | 'INVOICE_WRITE'
  | 'PAYMENT_WRITE'
  | 'REPORT_READ'
  | 'REPORT_FINANCIAL'

export const ROLES = ['ADMIN', 'MANAGER', 'HR', 'SALES', 'WAREHOUSE', 'ACCOUNTANT', 'EMPLOYEE'] as const
export type Role = (typeof ROLES)[number]

export interface Page<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export interface Ref {
  id: number
  name: string
}

export interface Me {
  id: number
  email: string
  fullName: string
  role: Role
  mustChangePassword: boolean
  permissions: Permission[]
  employeeId: number | null
}

export interface TokenResponse {
  accessToken: string
  expiresAt: string
  user: Me
}

export interface User {
  id: number
  email: string
  fullName: string
  role: Role
  active: boolean
  mustChangePassword: boolean
  locked: boolean
  lastLoginAt: string | null
  createdAt: string
}

export interface Company {
  name: string
  legalName: string | null
  taxId: string | null
  email: string | null
  phone: string | null
  addressLine: string | null
  city: string | null
  postalCode: string | null
  country: string | null
  currency: string
  timezone: string
  defaultTaxRate: number
  paymentTermsDays: number
  invoiceFooter: string | null
  version: number
}

// ---- HR ----
export const EMPLOYEE_STATUSES = ['ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED'] as const
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number]
export const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'] as const
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number]

export interface Department {
  id: number
  code: string
  name: string
  description: string | null
  parent: Ref | null
  manager: Ref | null
  active: boolean
  employeeCount: number
  version: number
}

export interface Employee {
  id: number
  employeeNumber: string
  firstName: string
  lastName: string
  fullName: string
  email: string
  phone: string | null
  jobTitle: string
  department: Ref | null
  manager: Ref | null
  userEmail: string | null
  employmentType: EmploymentType
  status: EmployeeStatus
  hireDate: string
  contractEndDate: string | null
  terminationDate: string | null
  createdAt: string
  version: number
}

export interface StatusChange {
  id: number
  fromStatus: EmployeeStatus | null
  toStatus: EmployeeStatus
  changedAt: string
  changedBy: string | null
  note: string | null
}

export const DOCUMENT_CATEGORIES = ['CONTRACT', 'IDENTITY', 'CERTIFICATE', 'OTHER'] as const
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number]

export interface EmployeeDocument {
  id: number
  category: DocumentCategory
  originalFilename: string
  contentType: string
  sizeBytes: number
  uploadedBy: string | null
  uploadedAt: string
}

export const LEAVE_TYPES = ['ANNUAL', 'SICK', 'UNPAID', 'PARENTAL', 'OTHER'] as const
export type LeaveType = (typeof LEAVE_TYPES)[number]
export const LEAVE_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const
export type LeaveStatus = (typeof LEAVE_STATUSES)[number]

export interface LeaveRequest {
  id: number
  employee: Ref
  departmentName: string | null
  type: LeaveType
  startDate: string
  endDate: string
  workingDays: number
  reason: string | null
  status: LeaveStatus
  decidedBy: string | null
  decidedAt: string | null
  decisionNote: string | null
  createdAt: string
}

// ---- Partners & inventory ----
export interface Partner {
  id: number
  code: string
  name: string
  contactName: string | null
  email: string | null
  phone: string | null
  taxId: string | null
  addressLine: string | null
  city: string | null
  postalCode: string | null
  country: string | null
  notes: string | null
  active: boolean
  createdAt: string
  version: number
}

export interface Category {
  id: number
  name: string
  description: string | null
  productCount: number
  version: number
}

export interface Product {
  id: number
  sku: string
  name: string
  description: string | null
  category: Ref | null
  supplier: Ref | null
  unit: string
  unitPrice: number
  costPrice: number
  taxRate: number
  quantityOnHand: number
  reorderLevel: number
  lowStock: boolean
  active: boolean
  updatedAt: string
  version: number
}

export const MOVEMENT_TYPES = ['RECEIPT', 'ISSUE', 'ADJUSTMENT', 'SALE', 'SALE_REVERSAL'] as const
export type MovementType = (typeof MOVEMENT_TYPES)[number]

export interface StockMovement {
  id: number
  product: Ref
  sku: string
  type: MovementType
  quantity: number
  quantityAfter: number
  unitCost: number | null
  supplier: Ref | null
  salesOrderId: number | null
  reference: string | null
  note: string | null
  createdAt: string
  createdBy: string | null
}

// ---- Sales & invoicing ----
export const ORDER_STATUSES = ['DRAFT', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export interface OrderSummary {
  id: number
  orderNumber: string
  customer: Ref
  status: OrderStatus
  orderDate: string
  currency: string
  total: number
  createdAt: string
}

export interface OrderLine {
  id: number
  lineNo: number
  product: Ref
  sku: string
  description: string
  quantity: number
  unitPrice: number
  discountPercent: number
  taxRate: number
  lineSubtotal: number
  lineTax: number
  lineTotal: number
}

export interface Order {
  id: number
  orderNumber: string
  customer: Ref
  status: OrderStatus
  orderDate: string
  notes: string | null
  currency: string
  subtotal: number
  discountTotal: number
  taxTotal: number
  total: number
  confirmedAt: string | null
  completedAt: string | null
  cancelledAt: string | null
  createdBy: string | null
  createdAt: string
  lines: OrderLine[]
  activeInvoiceId: number | null
  activeInvoiceNumber: string | null
  version: number
}

export const INVOICE_STATUSES = ['ISSUED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED'] as const
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]
export const PAYMENT_METHODS = ['BANK_TRANSFER', 'CASH', 'CHECK', 'CARD', 'OTHER'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export interface InvoiceSummary {
  id: number
  invoiceNumber: string
  customer: Ref
  status: InvoiceStatus
  issueDate: string
  dueDate: string
  currency: string
  total: number
  amountPaid: number
  balanceDue: number
  overdue: boolean
}

export interface InvoiceLine {
  lineNo: number
  productId: number | null
  description: string
  quantity: number
  unitPrice: number
  discountPercent: number
  taxRate: number
  lineSubtotal: number
  lineTax: number
  lineTotal: number
}

export interface PaymentRecord {
  id: number
  paymentDate: string
  amount: number
  method: PaymentMethod
  reference: string | null
  note: string | null
  recordedBy: string | null
  createdAt: string
}

export interface Invoice {
  id: number
  invoiceNumber: string
  customer: Ref
  salesOrder: Ref
  billToName: string
  billToAddress: string | null
  status: InvoiceStatus
  issueDate: string
  dueDate: string
  currency: string
  subtotal: number
  discountTotal: number
  taxTotal: number
  total: number
  amountPaid: number
  balanceDue: number
  overdue: boolean
  notes: string | null
  cancelledAt: string | null
  createdAt: string
  lines: InvoiceLine[]
  payments: PaymentRecord[]
  version: number
}

// ---- Dashboard, reports, audit, notifications, search ----
export interface Metric {
  current: number
  previous: number
}

export interface Dashboard {
  from: string
  to: string
  previousFrom: string
  previousTo: string
  counts: {
    employees?: number
    products?: number
    customers?: number
    openOrders?: number
    openInvoices?: number
  }
  financial?: {
    currency: string
    invoiced: Metric
    collected: Metric
    purchases: Metric
    outstanding: number
    overdueCount: number
  }
  trend?: { month: string; invoiced: number; collected: number; purchases: number }[]
  ordersByStatus?: Record<OrderStatus, number>
  lowStockCount?: number
  lowStock?: { id: number; sku: string; name: string; quantityOnHand: number; reorderLevel: number; unit: string }[]
  overdueInvoices?: {
    id: number
    invoiceNumber: string
    customer: string
    dueDate: string
    balanceDue: number
    currency: string
  }[]
  pendingLeaveRequests?: number
  recentActivity?: AuditEvent[]
}

export interface SalesReport {
  from: string
  to: string
  currency: string
  months: { month: string; orders: number; booked: number; invoiced: number; collected: number; purchases: number }[]
  booked: number
  invoiced: number
  collected: number
  purchases: number
  outstanding: number
  topProducts: { productId: number; sku: string; name: string; quantity: number; revenue: number }[]
}

export interface InventoryReport {
  currency: string
  valueAtCost: number
  valueAtPrice: number
  lowStockCount: number
  byCategory: { category: string; products: number; units: number; valueAtCost: number }[]
  lines: {
    id: number
    sku: string
    name: string
    category: string
    unit: string
    quantityOnHand: number
    reorderLevel: number
    costPrice: number
    valueAtCost: number
    valueAtPrice: number
    lowStock: boolean
  }[]
}

export interface HrReport {
  headcountByDepartment: { department: string; employees: number }[]
  totalHeadcount: number
}

export interface AuditEvent {
  id: number
  occurredAt: string
  actorId: number | null
  actorEmail: string | null
  action: string
  entityType: string | null
  entityId: string | null
  summary: string
  ipAddress: string | null
  correlationId: string | null
}

export interface AppNotification {
  id: number
  type: string
  title: string
  message: string
  link: string | null
  createdAt: string
  read: boolean
}

export interface SearchHit {
  type: 'product' | 'customer' | 'supplier' | 'employee' | 'order' | 'invoice'
  id: number
  title: string
  subtitle: string
  link: string
}
