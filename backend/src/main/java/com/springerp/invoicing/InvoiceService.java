package com.springerp.invoicing;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;

import com.springerp.audit.AuditAction;
import com.springerp.audit.AuditService;
import com.springerp.common.api.PageResponse;
import com.springerp.common.api.Pagination;
import com.springerp.common.error.BusinessException;
import com.springerp.common.error.NotFoundException;
import com.springerp.common.web.CsvWriter;
import com.springerp.company.CompanyService;
import com.springerp.company.CompanySettings;
import com.springerp.invoicing.InvoiceDtos.CreateInvoiceRequest;
import com.springerp.invoicing.InvoiceDtos.InvoiceLineResponse;
import com.springerp.invoicing.InvoiceDtos.InvoiceResponse;
import com.springerp.invoicing.InvoiceDtos.InvoiceSummary;
import com.springerp.invoicing.InvoiceDtos.PaymentRequest;
import com.springerp.invoicing.InvoiceDtos.PaymentResponse;
import com.springerp.invoicing.InvoiceDtos.Ref;
import com.springerp.notification.Notification;
import com.springerp.notification.NotificationService;
import com.springerp.numbering.DocumentNumberService;
import com.springerp.report.ExportAuditor;
import com.springerp.sales.SalesOrder;
import com.springerp.sales.SalesOrderLine;
import com.springerp.sales.SalesOrderRepository;
import com.springerp.security.CurrentUser;
import com.springerp.security.Permission;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class InvoiceService {

    private static final Set<String> SORTABLE = Set.of("invoiceNumber", "issueDate", "dueDate", "total", "status");

    private final InvoiceRepository invoices;
    private final PaymentRepository payments;
    private final SalesOrderRepository orders;
    private final CompanyService company;
    private final DocumentNumberService numbers;
    private final NotificationService notifications;
    private final AuditService audit;
    private final ExportAuditor exportAuditor;
    private final InvoicePdfRenderer pdfRenderer;
    private final Clock clock;

    @Transactional(readOnly = true)
    public PageResponse<InvoiceSummary> search(String search, Invoice.Status status, Long customerId,
            boolean overdueOnly, LocalDate from, LocalDate to, Pageable pageable) {
        LocalDate today = company.today();
        Pageable page = Pagination.sanitize(pageable, SORTABLE, Sort.by(Sort.Direction.DESC, "issueDate", "id"));
        return PageResponse.of(query(search, status, customerId, overdueOnly, from, to, today, page),
                i -> InvoiceSummary.from(i, today));
    }

    @Transactional(readOnly = true)
    public InvoiceResponse get(Long id) {
        return toResponse(findWithLines(id), company.today());
    }

    /** Issues an invoice for a confirmed or completed order, snapshotting its lines and billing details. */
    @Transactional
    public InvoiceResponse createFromOrder(CreateInvoiceRequest request) {
        SalesOrder order = orders.findByIdForUpdate(request.salesOrderId())
                .orElseThrow(() -> new NotFoundException("Sales order", request.salesOrderId()));
        if (order.getStatus() != SalesOrder.Status.CONFIRMED && order.getStatus() != SalesOrder.Status.COMPLETED) {
            throw BusinessException.conflict("ORDER_NOT_INVOICEABLE", "Only confirmed or completed orders can be invoiced.");
        }
        if (invoices.findFirstBySalesOrderIdAndStatusNot(order.getId(), Invoice.Status.CANCELLED).isPresent()) {
            throw BusinessException.conflict("ORDER_ALREADY_INVOICED", "This order already has an active invoice.");
        }
        CompanySettings settings = company.current();
        LocalDate issueDate = request.issueDate() != null ? request.issueDate() : company.today();
        LocalDate dueDate = request.dueDate() != null ? request.dueDate()
                : issueDate.plusDays(settings.getPaymentTermsDays());
        if (dueDate.isBefore(issueDate)) {
            throw BusinessException.rule("INVALID_DUE_DATE", "The due date cannot be before the issue date.");
        }

        Invoice invoice = new Invoice();
        invoice.setInvoiceNumber(numbers.nextYearly("INV", issueDate.getYear()));
        invoice.setSalesOrder(order);
        invoice.setCustomer(order.getCustomer());
        invoice.setBillToName(order.getCustomer().getName());
        invoice.setBillToAddress(order.getCustomer().formattedAddress());
        invoice.setIssueDate(issueDate);
        invoice.setDueDate(dueDate);
        invoice.setCurrency(order.getCurrency());
        invoice.setSubtotal(order.getSubtotal());
        invoice.setDiscountTotal(order.getDiscountTotal());
        invoice.setTaxTotal(order.getTaxTotal());
        invoice.setTotal(order.getTotal());
        invoice.setNotes(request.notes());
        for (SalesOrderLine ol : order.getLines()) {
            InvoiceLine line = new InvoiceLine();
            line.setInvoice(invoice);
            line.setLineNo(ol.getLineNo());
            line.setProductId(ol.getProduct().getId());
            line.setDescription(ol.getDescription());
            line.setQuantity(ol.getQuantity());
            line.setUnitPrice(ol.getUnitPrice());
            line.setDiscountPercent(ol.getDiscountPercent());
            line.setTaxRate(ol.getTaxRate());
            line.setLineSubtotal(ol.getLineSubtotal());
            line.setLineTax(ol.getLineTax());
            line.setLineTotal(ol.getLineTotal());
            invoice.getLines().add(line);
        }
        invoices.save(invoice);
        audit.record(AuditAction.INVOICE_ISSUED, "Invoice", invoice.getId(), "Issued invoice "
                + invoice.getInvoiceNumber() + " for order " + order.getOrderNumber() + " (" + invoice.getTotal()
                + " " + invoice.getCurrency() + ")");
        return toResponse(invoice, company.today());
    }

    /**
     * Records a manually received payment. The invoice row is locked so two clerks
     * entering payments at the same time cannot over-collect the invoice.
     */
    @Transactional
    public InvoiceResponse recordPayment(Long invoiceId, PaymentRequest request) {
        Invoice invoice = invoices.findByIdForUpdate(invoiceId)
                .orElseThrow(() -> new NotFoundException("Invoice", invoiceId));
        if (!Invoice.OPEN.contains(invoice.getStatus())) {
            throw BusinessException.conflict("INVOICE_NOT_OPEN", "Payments can only be recorded on open invoices.");
        }
        BigDecimal amount = request.amount().setScale(2);
        BigDecimal balance = invoice.balanceDue();
        if (amount.compareTo(balance) > 0) {
            throw BusinessException.rule("OVERPAYMENT", "The amount exceeds the balance due (" + balance + ").");
        }
        LocalDate today = company.today();
        LocalDate date = request.paymentDate() != null ? request.paymentDate() : today;
        if (date.isAfter(today)) {
            throw BusinessException.rule("FUTURE_PAYMENT", "The payment date cannot be in the future.");
        }
        if (date.isBefore(invoice.getIssueDate())) {
            throw BusinessException.rule("PAYMENT_BEFORE_ISSUE", "The payment date cannot precede the invoice date.");
        }

        Payment payment = new Payment();
        payment.setInvoice(invoice);
        payment.setAmount(amount);
        payment.setPaymentDate(date);
        payment.setMethod(request.method());
        payment.setReference(request.reference());
        payment.setNote(request.note());
        payment.setRecordedBy(CurrentUser.label());
        payment.setCreatedAt(clock.instant());
        payments.save(payment);

        invoice.setAmountPaid(invoice.getAmountPaid().add(amount));
        boolean fullyPaid = invoice.getAmountPaid().compareTo(invoice.getTotal()) == 0;
        invoice.setStatus(fullyPaid ? Invoice.Status.PAID : Invoice.Status.PARTIALLY_PAID);
        audit.record(AuditAction.PAYMENT_RECORDED, "Invoice", invoiceId, "Recorded " + request.method() + " payment of "
                + amount + " " + invoice.getCurrency() + " on " + invoice.getInvoiceNumber());
        if (fullyPaid) {
            notifications.notifyPermission(Permission.INVOICE_WRITE, Notification.Type.INVOICE_PAID,
                    "Invoice paid", invoice.getInvoiceNumber() + " (" + invoice.getBillToName() + ") is fully paid.",
                    "/invoices/" + invoiceId);
        }
        return toResponse(findWithLines(invoiceId), today);
    }

    @Transactional
    public InvoiceResponse cancel(Long id) {
        Invoice invoice = invoices.findByIdForUpdate(id).orElseThrow(() -> new NotFoundException("Invoice", id));
        if (invoice.getStatus() != Invoice.Status.ISSUED || invoice.getAmountPaid().signum() != 0) {
            throw BusinessException.conflict("INVOICE_NOT_CANCELLABLE",
                    "Only invoices without any recorded payment can be cancelled.");
        }
        invoice.setStatus(Invoice.Status.CANCELLED);
        invoice.setCancelledAt(clock.instant());
        audit.record(AuditAction.INVOICE_CANCELLED, "Invoice", id, "Cancelled invoice " + invoice.getInvoiceNumber());
        return toResponse(findWithLines(id), company.today());
    }

    @Transactional(readOnly = true)
    public byte[] pdf(Long id) {
        Invoice invoice = findWithLines(id);
        return pdfRenderer.render(invoice, payments.findByInvoiceIdOrderByPaymentDateAscIdAsc(id), company.current(),
                company.today());
    }

    @Transactional(readOnly = true)
    public String invoiceNumber(Long id) {
        return invoices.findById(id).map(Invoice::getInvoiceNumber).orElseThrow(() -> new NotFoundException("Invoice", id));
    }

    @Transactional(readOnly = true)
    public CsvWriter exportCsv(String search, Invoice.Status status, Long customerId, boolean overdueOnly,
            LocalDate from, LocalDate to) {
        LocalDate today = company.today();
        CsvWriter csv = new CsvWriter().row("Number", "Customer", "Status", "Issue date", "Due date", "Currency",
                "Subtotal", "Discount", "Tax", "Total", "Paid", "Balance", "Overdue");
        Page<Invoice> chunk;
        int page = 0;
        int rows = 0;
        do {
            chunk = query(search, status, customerId, overdueOnly, from, to, today,
                    PageRequest.of(page++, 500, Sort.by("issueDate", "id")));
            for (Invoice i : chunk) {
                csv.row(i.getInvoiceNumber(), i.getBillToName(), i.getStatus(), i.getIssueDate(), i.getDueDate(),
                        i.getCurrency(), i.getSubtotal(), i.getDiscountTotal(), i.getTaxTotal(), i.getTotal(),
                        i.getAmountPaid(), i.balanceDue(), i.isOverdue(today));
                rows++;
            }
        } while (chunk.hasNext() && rows < 10_000);
        exportAuditor.record("invoices", rows);
        return csv;
    }

    private Page<Invoice> query(String search, Invoice.Status status, Long customerId, boolean overdueOnly,
            LocalDate from, LocalDate to, LocalDate today, Pageable page) {
        return invoices.search(Pagination.likePattern(search), status, customerId, overdueOnly ? today : null,
                Invoice.OPEN, from, to, page);
    }

    private Invoice findWithLines(Long id) {
        return invoices.findWithLines(id).orElseThrow(() -> new NotFoundException("Invoice", id));
    }

    private InvoiceResponse toResponse(Invoice i, LocalDate today) {
        List<PaymentResponse> paymentList = i.getId() == null ? List.of()
                : payments.findByInvoiceIdOrderByPaymentDateAscIdAsc(i.getId()).stream()
                        .map(PaymentResponse::from).toList();
        return new InvoiceResponse(i.getId(), i.getInvoiceNumber(),
                new Ref(i.getCustomer().getId(), i.getCustomer().getName()),
                new Ref(i.getSalesOrder().getId(), i.getSalesOrder().getOrderNumber()), i.getBillToName(),
                i.getBillToAddress(), i.getStatus(), i.getIssueDate(), i.getDueDate(), i.getCurrency(),
                i.getSubtotal(), i.getDiscountTotal(), i.getTaxTotal(), i.getTotal(), i.getAmountPaid(),
                i.balanceDue(), i.isOverdue(today), i.getNotes(), i.getCancelledAt(), i.getCreatedAt(),
                i.getLines().stream().map(InvoiceLineResponse::from).toList(), paymentList, i.getVersion());
    }
}
