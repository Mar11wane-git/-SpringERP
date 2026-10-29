package com.springerp.dashboard;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

import com.springerp.audit.AuditService;
import com.springerp.audit.AuditService.AuditEventResponse;
import com.springerp.company.CompanyService;
import com.springerp.hr.EmployeeRepository;
import com.springerp.hr.Employee;
import com.springerp.hr.LeaveRequest;
import com.springerp.hr.LeaveRequestRepository;
import com.springerp.inventory.ProductRepository;
import com.springerp.inventory.StockMovementRepository;
import com.springerp.invoicing.Invoice;
import com.springerp.invoicing.InvoiceRepository;
import com.springerp.invoicing.PaymentRepository;
import com.springerp.partner.CustomerRepository;
import com.springerp.report.Periods;
import com.springerp.report.Periods.Range;
import com.springerp.sales.SalesOrder;
import com.springerp.sales.SalesOrderRepository;
import com.springerp.security.CurrentUser;
import com.springerp.security.Permission;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Aggregates live figures for the home dashboard. Every section is computed only
 * when the caller holds the matching permission and is otherwise omitted (null).
 */
@Service
@RequiredArgsConstructor
public class DashboardService {

    private final CompanyService company;
    private final EmployeeRepository employees;
    private final LeaveRequestRepository leaves;
    private final ProductRepository products;
    private final StockMovementRepository movements;
    private final CustomerRepository customers;
    private final SalesOrderRepository orders;
    private final InvoiceRepository invoices;
    private final PaymentRepository payments;
    private final AuditService audit;

    public record Counts(Long employees, Long products, Long customers, Long openOrders, Long openInvoices) {
    }

    public record Metric(BigDecimal current, BigDecimal previous) {
    }

    public record Financial(String currency, Metric invoiced, Metric collected, Metric purchases,
            BigDecimal outstanding, long overdueCount) {
    }

    public record TrendPoint(String month, BigDecimal invoiced, BigDecimal collected, BigDecimal purchases) {
    }

    public record LowStockItem(Long id, String sku, String name, int quantityOnHand, int reorderLevel, String unit) {
    }

    public record OverdueInvoice(Long id, String invoiceNumber, String customer, LocalDate dueDate,
            BigDecimal balanceDue, String currency) {
    }

    public record DashboardResponse(LocalDate from, LocalDate to, LocalDate previousFrom, LocalDate previousTo,
            Counts counts, Financial financial, List<TrendPoint> trend, Map<SalesOrder.Status, Long> ordersByStatus,
            Long lowStockCount, List<LowStockItem> lowStock, List<OverdueInvoice> overdueInvoices,
            Long pendingLeaveRequests, List<AuditEventResponse> recentActivity) {
    }

    @Transactional(readOnly = true)
    public DashboardResponse get(LocalDate from, LocalDate to) {
        LocalDate today = company.today();
        Range range = Periods.resolve(from, to, today);
        Range previous = range.previous();

        Counts counts = new Counts(
                has(Permission.EMPLOYEE_READ) ? employees.countByStatusNot(Employee.Status.TERMINATED) : null,
                has(Permission.INVENTORY_READ) ? products.countByActiveTrue() : null,
                has(Permission.PARTNER_READ) ? customers.countByActiveTrue() : null,
                has(Permission.SALES_READ) ? orders.countByStatus(SalesOrder.Status.DRAFT)
                        + orders.countByStatus(SalesOrder.Status.CONFIRMED) : null,
                has(Permission.INVOICE_READ) ? invoices.search(null, null, null, null, Invoice.OPEN, null, null,
                        PageRequest.of(0, 1)).getTotalElements() : null);

        Financial financial = null;
        List<TrendPoint> trend = null;
        if (has(Permission.REPORT_FINANCIAL)) {
            ZoneId zone = ZoneId.of(company.current().getTimezone());
            financial = new Financial(company.current().getCurrency(),
                    new Metric(invoices.invoicedBetween(range.from(), range.to()),
                            invoices.invoicedBetween(previous.from(), previous.to())),
                    new Metric(payments.collectedBetween(range.from(), range.to()),
                            payments.collectedBetween(previous.from(), previous.to())),
                    new Metric(purchases(range, zone), purchases(previous, zone)),
                    invoices.outstandingTotal(Invoice.OPEN),
                    invoices.countOverdue(Invoice.OPEN, today));
            trend = trend(range.to(), zone);
        }

        Map<SalesOrder.Status, Long> byStatus = null;
        if (has(Permission.SALES_READ)) {
            byStatus = new EnumMap<>(SalesOrder.Status.class);
            for (SalesOrder.Status s : SalesOrder.Status.values()) {
                byStatus.put(s, 0L);
            }
            for (Object[] r : orders.countByStatusGrouped()) {
                byStatus.put((SalesOrder.Status) r[0], (Long) r[1]);
            }
        }

        Long lowStockCount = null;
        List<LowStockItem> lowStock = null;
        if (has(Permission.INVENTORY_READ)) {
            lowStockCount = products.countLowStock();
            lowStock = products.findLowStock(PageRequest.of(0, 6)).stream()
                    .map(p -> new LowStockItem(p.getId(), p.getSku(), p.getName(), p.getQuantityOnHand(),
                            p.getReorderLevel(), p.getUnit()))
                    .toList();
        }

        List<OverdueInvoice> overdue = !has(Permission.INVOICE_READ) ? null
                : invoices.findOverdue(Invoice.OPEN, today, PageRequest.of(0, 6)).stream()
                        .map(i -> new OverdueInvoice(i.getId(), i.getInvoiceNumber(), i.getBillToName(), i.getDueDate(),
                                i.balanceDue(), i.getCurrency()))
                        .toList();

        return new DashboardResponse(range.from(), range.to(), previous.from(), previous.to(), counts, financial,
                trend, byStatus, lowStockCount, lowStock, overdue,
                has(Permission.LEAVE_APPROVE) ? leaves.countByStatus(LeaveRequest.Status.PENDING) : null,
                has(Permission.AUDIT_READ) ? audit.recent() : null);
    }

    /** Six calendar months ending with the month of {@code end}. */
    private List<TrendPoint> trend(LocalDate end, ZoneId zone) {
        Range range = new Range(YearMonth.from(end).minusMonths(5).atDay(1), YearMonth.from(end).atEndOfMonth());
        Map<YearMonth, BigDecimal[]> buckets = Periods.monthBuckets(range, 3);
        Periods.accumulate(buckets, invoices.monthlyInvoiced(range.from(), range.to()), 3, 0);
        Periods.accumulate(buckets, payments.monthlyCollected(range.from(), range.to()), 2, 1);
        for (Object[] r : movements.purchasesBetween(start(range.from(), zone), start(range.to().plusDays(1), zone))) {
            YearMonth m = YearMonth.from(((Instant) r[0]).atZone(zone));
            BigDecimal[] values = buckets.get(m);
            if (values != null) {
                values[2] = values[2].add(Periods.toDecimal(r[1]));
            }
        }
        return buckets.entrySet().stream()
                .map(e -> new TrendPoint(e.getKey().toString(), e.getValue()[0], e.getValue()[1], e.getValue()[2]))
                .toList();
    }

    private BigDecimal purchases(Range range, ZoneId zone) {
        return Periods.toDecimal(movements.purchaseValueBetween(start(range.from(), zone),
                start(range.to().plusDays(1), zone)));
    }

    private static Instant start(LocalDate date, ZoneId zone) {
        return date.atStartOfDay(zone).toInstant();
    }

    private static boolean has(Permission permission) {
        return CurrentUser.has(permission);
    }
}
