package com.springerp.invoicing;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public final class InvoiceDtos {

    private InvoiceDtos() {
    }

    public record Ref(Long id, String name) {
    }

    public record CreateInvoiceRequest(@NotNull Long salesOrderId, LocalDate issueDate, LocalDate dueDate,
            @Size(max = 1000) String notes) {
    }

    public record PaymentRequest(
            @NotNull @DecimalMin(value = "0.01") @Digits(integer = 17, fraction = 2) BigDecimal amount,
            LocalDate paymentDate,
            @NotNull Payment.Method method,
            @Size(max = 100) String reference,
            @Size(max = 255) String note) {
    }

    public record InvoiceSummary(Long id, String invoiceNumber, Ref customer, Invoice.Status status,
            LocalDate issueDate, LocalDate dueDate, String currency, BigDecimal total, BigDecimal amountPaid,
            BigDecimal balanceDue, boolean overdue) {

        static InvoiceSummary from(Invoice i, LocalDate today) {
            return new InvoiceSummary(i.getId(), i.getInvoiceNumber(),
                    new Ref(i.getCustomer().getId(), i.getBillToName()), i.getStatus(), i.getIssueDate(),
                    i.getDueDate(), i.getCurrency(), i.getTotal(), i.getAmountPaid(), i.balanceDue(),
                    i.isOverdue(today));
        }
    }

    public record InvoiceLineResponse(int lineNo, Long productId, String description, int quantity,
            BigDecimal unitPrice, BigDecimal discountPercent, BigDecimal taxRate, BigDecimal lineSubtotal,
            BigDecimal lineTax, BigDecimal lineTotal) {

        static InvoiceLineResponse from(InvoiceLine l) {
            return new InvoiceLineResponse(l.getLineNo(), l.getProductId(), l.getDescription(), l.getQuantity(),
                    l.getUnitPrice(), l.getDiscountPercent(), l.getTaxRate(), l.getLineSubtotal(), l.getLineTax(),
                    l.getLineTotal());
        }
    }

    public record PaymentResponse(Long id, LocalDate paymentDate, BigDecimal amount, Payment.Method method,
            String reference, String note, String recordedBy, Instant createdAt) {

        static PaymentResponse from(Payment p) {
            return new PaymentResponse(p.getId(), p.getPaymentDate(), p.getAmount(), p.getMethod(), p.getReference(),
                    p.getNote(), p.getRecordedBy(), p.getCreatedAt());
        }
    }

    public record InvoiceResponse(Long id, String invoiceNumber, Ref customer, Ref salesOrder, String billToName,
            String billToAddress, Invoice.Status status, LocalDate issueDate, LocalDate dueDate, String currency,
            BigDecimal subtotal, BigDecimal discountTotal, BigDecimal taxTotal, BigDecimal total,
            BigDecimal amountPaid, BigDecimal balanceDue, boolean overdue, String notes, Instant cancelledAt,
            Instant createdAt, List<InvoiceLineResponse> lines, List<PaymentResponse> payments, long version) {
    }
}
