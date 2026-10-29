package com.springerp.sales;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public final class SalesDtos {

    private SalesDtos() {
    }

    public record Ref(Long id, String name) {
    }

    public record OrderLineRequest(
            @NotNull Long productId,
            @NotNull @Min(1) @Max(1_000_000) Integer quantity,
            /** Defaults to the product's current price when omitted. */
            @DecimalMin("0.00") @Digits(integer = 17, fraction = 2) BigDecimal unitPrice,
            @DecimalMin("0.00") @DecimalMax("100.00") BigDecimal discountPercent) {
    }

    public record OrderRequest(
            @NotNull Long customerId,
            LocalDate orderDate,
            @Size(max = 1000) String notes,
            @NotEmpty @Size(max = 200) List<@Valid OrderLineRequest> lines,
            Long version) {
    }

    public record OrderLineResponse(Long id, int lineNo, Ref product, String sku, String description, int quantity,
            BigDecimal unitPrice, BigDecimal discountPercent, BigDecimal taxRate, BigDecimal lineSubtotal,
            BigDecimal lineTax, BigDecimal lineTotal) {

        static OrderLineResponse from(SalesOrderLine l) {
            return new OrderLineResponse(l.getId(), l.getLineNo(),
                    new Ref(l.getProduct().getId(), l.getProduct().getName()), l.getProduct().getSku(),
                    l.getDescription(), l.getQuantity(), l.getUnitPrice(), l.getDiscountPercent(), l.getTaxRate(),
                    l.getLineSubtotal(), l.getLineTax(), l.getLineTotal());
        }
    }

    public record OrderSummary(Long id, String orderNumber, Ref customer, SalesOrder.Status status,
            LocalDate orderDate, String currency, BigDecimal total, Instant createdAt) {

        static OrderSummary from(SalesOrder o) {
            return new OrderSummary(o.getId(), o.getOrderNumber(),
                    new Ref(o.getCustomer().getId(), o.getCustomer().getName()), o.getStatus(), o.getOrderDate(),
                    o.getCurrency(), o.getTotal(), o.getCreatedAt());
        }
    }

    public record OrderResponse(Long id, String orderNumber, Ref customer, SalesOrder.Status status,
            LocalDate orderDate, String notes, String currency, BigDecimal subtotal, BigDecimal discountTotal,
            BigDecimal taxTotal, BigDecimal total, Instant confirmedAt, Instant completedAt, Instant cancelledAt,
            String createdBy, Instant createdAt, List<OrderLineResponse> lines, Long activeInvoiceId,
            String activeInvoiceNumber, long version) {
    }
}
