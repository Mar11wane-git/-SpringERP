package com.springerp.sales;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;

import com.springerp.audit.AuditAction;
import com.springerp.audit.AuditService;
import com.springerp.common.api.PageResponse;
import com.springerp.common.api.Pagination;
import com.springerp.common.error.BusinessException;
import com.springerp.common.error.NotFoundException;
import com.springerp.company.CompanyService;
import com.springerp.inventory.Product;
import com.springerp.inventory.ProductService;
import com.springerp.inventory.StockMovement;
import com.springerp.inventory.StockService;
import com.springerp.invoicing.Invoice;
import com.springerp.invoicing.InvoiceRepository;
import com.springerp.notification.Notification;
import com.springerp.notification.NotificationService;
import com.springerp.numbering.DocumentNumberService;
import com.springerp.partner.Customer;
import com.springerp.partner.CustomerService;
import com.springerp.sales.SalesDtos.OrderLineRequest;
import com.springerp.sales.SalesDtos.OrderLineResponse;
import com.springerp.sales.SalesDtos.OrderRequest;
import com.springerp.sales.SalesDtos.OrderResponse;
import com.springerp.sales.SalesDtos.OrderSummary;
import com.springerp.sales.SalesDtos.Ref;
import com.springerp.security.CurrentUser;
import com.springerp.security.Permission;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SalesOrderService {

    private static final Set<String> SORTABLE = Set.of("orderNumber", "orderDate", "total", "status", "createdAt");

    private final SalesOrderRepository orders;
    private final InvoiceRepository invoices;
    private final CustomerService customers;
    private final ProductService products;
    private final StockService stock;
    private final CompanyService company;
    private final DocumentNumberService numbers;
    private final NotificationService notifications;
    private final AuditService audit;
    private final Clock clock;

    @Transactional(readOnly = true)
    public PageResponse<OrderSummary> search(String search, SalesOrder.Status status, Long customerId,
            LocalDate from, LocalDate to, Pageable pageable) {
        Pageable page = Pagination.sanitize(pageable, SORTABLE, Sort.by(Sort.Direction.DESC, "orderDate", "id"));
        return PageResponse.of(orders.search(Pagination.likePattern(search), status, customerId, from, to, page),
                OrderSummary::from);
    }

    @Transactional(readOnly = true)
    public OrderResponse get(Long id) {
        return toResponse(orders.findWithLines(id).orElseThrow(() -> new NotFoundException("Sales order", id)));
    }

    @Transactional
    public OrderResponse create(OrderRequest request) {
        SalesOrder order = new SalesOrder();
        LocalDate date = request.orderDate() != null ? request.orderDate() : company.today();
        order.setOrderNumber(numbers.nextYearly("SO", date.getYear()));
        order.setCurrency(company.current().getCurrency());
        order.setCreatedBy(CurrentUser.label());
        apply(order, request, date);
        orders.save(order);
        audit.record(AuditAction.ORDER_CREATED, "SalesOrder", order.getId(),
                "Created order " + order.getOrderNumber() + " for " + order.getCustomer().getName());
        return toResponse(order);
    }

    @Transactional
    public OrderResponse update(Long id, OrderRequest request) {
        SalesOrder order = find(id);
        if (request.version() != null && request.version() != order.getVersion()) {
            throw new ObjectOptimisticLockingFailureException(SalesOrder.class, id);
        }
        requireStatus(order, SalesOrder.Status.DRAFT, "Only draft orders can be edited.");
        apply(order, request, request.orderDate() != null ? request.orderDate() : order.getOrderDate());
        audit.record(AuditAction.ORDER_UPDATED, "SalesOrder", id, "Updated order " + order.getOrderNumber());
        return toResponse(order);
    }

    /**
     * Confirms the order and takes the goods out of stock in the same transaction:
     * either every line is fulfilled or nothing changes. Products are locked in id
     * order so two orders sharing products cannot deadlock each other.
     */
    @Transactional
    public OrderResponse confirm(Long id) {
        SalesOrder order = lockAndLoad(id);
        requireStatus(order, SalesOrder.Status.DRAFT, "Only draft orders can be confirmed.");
        order.getLines().stream()
                .sorted(Comparator.comparing(l -> l.getProduct().getId()))
                .forEach(l -> stock.apply(l.getProduct().getId(), StockMovement.Type.SALE, -l.getQuantity(), null,
                        null, order.getId(), order.getOrderNumber(), null));
        order.setStatus(SalesOrder.Status.CONFIRMED);
        order.setConfirmedAt(clock.instant());
        audit.record(AuditAction.ORDER_CONFIRMED, "SalesOrder", id, "Confirmed order " + order.getOrderNumber());
        notifications.notifyPermission(Permission.INVOICE_WRITE, Notification.Type.ORDER_CONFIRMED,
                "Order ready to invoice", order.getOrderNumber() + " for " + order.getCustomer().getName()
                        + " was confirmed.", "/sales/orders/" + id);
        return toResponse(order);
    }

    @Transactional
    public OrderResponse complete(Long id) {
        SalesOrder order = lockAndLoad(id);
        requireStatus(order, SalesOrder.Status.CONFIRMED, "Only confirmed orders can be completed.");
        order.setStatus(SalesOrder.Status.COMPLETED);
        order.setCompletedAt(clock.instant());
        audit.record(AuditAction.ORDER_COMPLETED, "SalesOrder", id, "Completed order " + order.getOrderNumber());
        return toResponse(order);
    }

    /** Cancels a draft, or a confirmed order that is not invoiced, returning its goods to stock. */
    @Transactional
    public OrderResponse cancel(Long id) {
        SalesOrder order = lockAndLoad(id);
        if (order.getStatus() != SalesOrder.Status.DRAFT && order.getStatus() != SalesOrder.Status.CONFIRMED) {
            throw BusinessException.conflict("ORDER_NOT_CANCELLABLE",
                    "Only draft or confirmed orders can be cancelled.");
        }
        if (invoices.findFirstBySalesOrderIdAndStatusNot(id, Invoice.Status.CANCELLED).isPresent()) {
            throw BusinessException.conflict("ORDER_INVOICED", "Cancel the invoice of this order first.");
        }
        if (order.getStatus() == SalesOrder.Status.CONFIRMED) {
            order.getLines().stream()
                    .sorted(Comparator.comparing(l -> l.getProduct().getId()))
                    .forEach(l -> stock.apply(l.getProduct().getId(), StockMovement.Type.SALE_REVERSAL,
                            l.getQuantity(), null, null, order.getId(), order.getOrderNumber(), "Order cancelled"));
        }
        order.setStatus(SalesOrder.Status.CANCELLED);
        order.setCancelledAt(clock.instant());
        audit.record(AuditAction.ORDER_CANCELLED, "SalesOrder", id, "Cancelled order " + order.getOrderNumber());
        return toResponse(order);
    }

    private void apply(SalesOrder order, OrderRequest request, LocalDate date) {
        Customer customer = customers.find(request.customerId());
        if (!customer.isActive()) {
            throw BusinessException.rule("CUSTOMER_INACTIVE", "This customer is archived.");
        }
        order.setCustomer(customer);
        order.setOrderDate(date);
        order.setNotes(request.notes());

        order.getLines().clear();
        // Flush the orphan deletes before re-inserting, so (order_id, line_no) stays unique.
        orders.flush();
        List<Pricing.LineAmounts> amounts = new ArrayList<>();
        int lineNo = 1;
        for (OrderLineRequest r : request.lines()) {
            Product product = products.find(r.productId());
            if (!product.isActive()) {
                throw BusinessException.rule("PRODUCT_INACTIVE", "Product " + product.getSku() + " is archived.");
            }
            BigDecimal unitPrice = r.unitPrice() != null ? r.unitPrice() : product.getUnitPrice();
            BigDecimal discount = r.discountPercent() != null ? r.discountPercent() : BigDecimal.ZERO;
            Pricing.LineAmounts a = Pricing.line(r.quantity(), unitPrice, discount, product.getTaxRate());
            amounts.add(a);

            SalesOrderLine line = new SalesOrderLine();
            line.setOrder(order);
            line.setLineNo(lineNo++);
            line.setProduct(product);
            line.setDescription(product.getName());
            line.setQuantity(r.quantity());
            line.setUnitPrice(unitPrice.setScale(Pricing.SCALE));
            line.setDiscountPercent(discount.setScale(2));
            line.setTaxRate(product.getTaxRate());
            line.setLineSubtotal(a.net());
            line.setLineTax(a.tax());
            line.setLineTotal(a.total());
            order.getLines().add(line);
        }
        Pricing.Totals totals = Pricing.totals(amounts);
        order.setSubtotal(totals.subtotal());
        order.setDiscountTotal(totals.discountTotal());
        order.setTaxTotal(totals.taxTotal());
        order.setTotal(totals.total());
    }

    private SalesOrder lockAndLoad(Long id) {
        orders.findByIdForUpdate(id).orElseThrow(() -> new NotFoundException("Sales order", id));
        return find(id);
    }

    private SalesOrder find(Long id) {
        return orders.findWithLines(id).orElseThrow(() -> new NotFoundException("Sales order", id));
    }

    private static void requireStatus(SalesOrder order, SalesOrder.Status expected, String message) {
        if (order.getStatus() != expected) {
            throw BusinessException.conflict("INVALID_ORDER_STATUS", message);
        }
    }

    private OrderResponse toResponse(SalesOrder o) {
        Invoice invoice = o.getId() == null ? null
                : invoices.findFirstBySalesOrderIdAndStatusNot(o.getId(), Invoice.Status.CANCELLED).orElse(null);
        return new OrderResponse(o.getId(), o.getOrderNumber(),
                new Ref(o.getCustomer().getId(), o.getCustomer().getName()), o.getStatus(), o.getOrderDate(),
                o.getNotes(), o.getCurrency(), o.getSubtotal(), o.getDiscountTotal(), o.getTaxTotal(), o.getTotal(),
                o.getConfirmedAt(), o.getCompletedAt(), o.getCancelledAt(), o.getCreatedBy(), o.getCreatedAt(),
                o.getLines().stream().map(OrderLineResponse::from).toList(),
                invoice == null ? null : invoice.getId(), invoice == null ? null : invoice.getInvoiceNumber(),
                o.getVersion());
    }
}
