package com.springerp.report;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.springerp.common.web.CsvWriter;
import com.springerp.company.CompanyService;
import com.springerp.hr.EmployeeRepository;
import com.springerp.inventory.Product;
import com.springerp.inventory.ProductRepository;
import com.springerp.inventory.StockMovementRepository;
import com.springerp.invoicing.Invoice;
import com.springerp.invoicing.InvoiceRepository;
import com.springerp.invoicing.PaymentRepository;
import com.springerp.report.Periods.Range;
import com.springerp.sales.SalesOrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Read-only business reports. Monthly buckets use the company time zone for
 * instant-based data (stock receipts); business dates are already local dates.
 */
@Service
@RequiredArgsConstructor
public class ReportService {

    private final CompanyService company;
    private final SalesOrderRepository orders;
    private final InvoiceRepository invoices;
    private final PaymentRepository payments;
    private final ProductRepository products;
    private final StockMovementRepository movements;
    private final EmployeeRepository employees;
    private final ExportAuditor exportAuditor;

    public record SalesMonth(String month, long orders, BigDecimal booked, BigDecimal invoiced, BigDecimal collected,
            BigDecimal purchases) {
    }

    public record TopProduct(Long productId, String sku, String name, long quantity, BigDecimal revenue) {
    }

    public record SalesReport(LocalDate from, LocalDate to, String currency, List<SalesMonth> months,
            BigDecimal booked, BigDecimal invoiced, BigDecimal collected, BigDecimal purchases,
            BigDecimal outstanding, List<TopProduct> topProducts) {
    }

    public record InventoryLine(Long id, String sku, String name, String category, String unit, int quantityOnHand,
            int reorderLevel, BigDecimal costPrice, BigDecimal valueAtCost, BigDecimal valueAtPrice, boolean lowStock) {
    }

    public record CategoryValue(String category, long products, long units, BigDecimal valueAtCost) {
    }

    public record InventoryReport(String currency, BigDecimal valueAtCost, BigDecimal valueAtPrice, long lowStockCount,
            List<CategoryValue> byCategory, List<InventoryLine> lines) {
    }

    public record Headcount(String department, long employees) {
    }

    public record HrReport(List<Headcount> headcountByDepartment, long totalHeadcount) {
    }

    @Transactional(readOnly = true)
    public SalesReport sales(LocalDate from, LocalDate to) {
        Range range = Periods.resolve(from, to, company.today());
        ZoneId zone = ZoneId.of(company.current().getTimezone());

        Map<YearMonth, BigDecimal[]> buckets = Periods.monthBuckets(range, 5);
        List<Object[]> bookings = orders.monthlyBookings(range.from(), range.to());
        Periods.accumulate(buckets, bookings, 2, 0);
        Periods.accumulate(buckets, bookings, 3, 1);
        Periods.accumulate(buckets, invoices.monthlyInvoiced(range.from(), range.to()), 3, 2);
        Periods.accumulate(buckets, payments.monthlyCollected(range.from(), range.to()), 2, 3);
        Instant start = range.from().atStartOfDay(zone).toInstant();
        Instant end = range.to().plusDays(1).atStartOfDay(zone).toInstant();
        for (Object[] r : movements.purchasesBetween(start, end)) {
            BigDecimal[] values = buckets.get(YearMonth.from(((Instant) r[0]).atZone(zone)));
            if (values != null) {
                values[4] = values[4].add(Periods.toDecimal(r[1]));
            }
        }
        List<SalesMonth> months = buckets.entrySet().stream()
                .map(e -> new SalesMonth(e.getKey().toString(), e.getValue()[0].longValue(), e.getValue()[1],
                        e.getValue()[2], e.getValue()[3], e.getValue()[4]))
                .toList();

        List<TopProduct> top = orders.topProducts(range.from(), range.to(), PageRequest.of(0, 10)).stream()
                .map(r -> new TopProduct((Long) r[0], (String) r[1], (String) r[2], ((Number) r[3]).longValue(),
                        Periods.toDecimal(r[4])))
                .toList();

        BigDecimal zero = BigDecimal.ZERO.setScale(2);
        return new SalesReport(range.from(), range.to(), company.current().getCurrency(), months,
                months.stream().map(SalesMonth::booked).reduce(zero, BigDecimal::add),
                months.stream().map(SalesMonth::invoiced).reduce(zero, BigDecimal::add),
                months.stream().map(SalesMonth::collected).reduce(zero, BigDecimal::add),
                months.stream().map(SalesMonth::purchases).reduce(zero, BigDecimal::add),
                Periods.toDecimal(invoices.outstandingTotal(Invoice.OPEN)), top);
    }

    @Transactional(readOnly = true)
    public CsvWriter salesCsv(LocalDate from, LocalDate to) {
        SalesReport report = sales(from, to);
        CsvWriter csv = new CsvWriter().row("Month", "Orders", "Booked", "Invoiced", "Collected", "Purchases",
                "Currency");
        report.months().forEach(m -> csv.row(m.month(), m.orders(), m.booked(), m.invoiced(), m.collected(),
                m.purchases(), report.currency()));
        exportAuditor.record("sales report", report.months().size());
        return csv;
    }

    @Transactional(readOnly = true)
    public InventoryReport inventory() {
        List<InventoryLine> lines = new ArrayList<>();
        Map<String, long[]> catCounts = new LinkedHashMap<>();
        Map<String, BigDecimal> catValues = new LinkedHashMap<>();
        BigDecimal atCost = BigDecimal.ZERO.setScale(2);
        BigDecimal atPrice = BigDecimal.ZERO.setScale(2);
        long low = 0;
        for (Product p : products.findAllActiveWithCategory()) {
            BigDecimal qty = BigDecimal.valueOf(p.getQuantityOnHand());
            BigDecimal cost = p.getCostPrice().multiply(qty).setScale(2);
            BigDecimal price = p.getUnitPrice().multiply(qty).setScale(2);
            String category = p.getCategory() == null ? "Uncategorized" : p.getCategory().getName();
            lines.add(new InventoryLine(p.getId(), p.getSku(), p.getName(), category, p.getUnit(),
                    p.getQuantityOnHand(), p.getReorderLevel(), p.getCostPrice(), cost, price, p.isLowStock()));
            atCost = atCost.add(cost);
            atPrice = atPrice.add(price);
            if (p.isLowStock()) {
                low++;
            }
            long[] c = catCounts.computeIfAbsent(category, k -> new long[2]);
            c[0]++;
            c[1] += p.getQuantityOnHand();
            catValues.merge(category, cost, BigDecimal::add);
        }
        List<CategoryValue> byCategory = catCounts.entrySet().stream()
                .map(e -> new CategoryValue(e.getKey(), e.getValue()[0], e.getValue()[1], catValues.get(e.getKey())))
                .sorted((a, b) -> b.valueAtCost().compareTo(a.valueAtCost()))
                .toList();
        return new InventoryReport(company.current().getCurrency(), atCost, atPrice, low, byCategory, lines);
    }

    @Transactional(readOnly = true)
    public CsvWriter inventoryCsv() {
        InventoryReport report = inventory();
        CsvWriter csv = new CsvWriter().row("SKU", "Name", "Category", "Unit", "On hand", "Reorder level",
                "Cost price", "Value at cost", "Value at price", "Low stock");
        report.lines().forEach(l -> csv.row(l.sku(), l.name(), l.category(), l.unit(), l.quantityOnHand(),
                l.reorderLevel(), l.costPrice(), l.valueAtCost(), l.valueAtPrice(), l.lowStock()));
        exportAuditor.record("inventory valuation", report.lines().size());
        return csv;
    }

    @Transactional(readOnly = true)
    public HrReport hr() {
        List<Headcount> rows = employees.headcountByDepartment().stream()
                .map(r -> new Headcount(r[0] == null ? "Unassigned" : (String) r[0], (Long) r[1]))
                .sorted((a, b) -> Long.compare(b.employees(), a.employees()))
                .toList();
        return new HrReport(rows, rows.stream().mapToLong(Headcount::employees).sum());
    }
}
