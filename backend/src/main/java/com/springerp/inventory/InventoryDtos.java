package com.springerp.inventory;

import java.math.BigDecimal;
import java.time.Instant;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class InventoryDtos {

    private InventoryDtos() {
    }

    public record Ref(Long id, String name) {
    }

    public record CategoryResponse(Long id, String name, String description, long productCount, long version) {
    }

    public record CategoryRequest(@NotBlank @Size(max = 100) String name, @Size(max = 500) String description,
            Long version) {
    }

    public record ProductResponse(Long id, String sku, String name, String description, Ref category, Ref supplier,
            String unit, BigDecimal unitPrice, BigDecimal costPrice, BigDecimal taxRate, int quantityOnHand,
            int reorderLevel, boolean lowStock, boolean active, Instant updatedAt, long version) {

        public static ProductResponse from(Product p) {
            return new ProductResponse(p.getId(), p.getSku(), p.getName(), p.getDescription(),
                    p.getCategory() == null ? null : new Ref(p.getCategory().getId(), p.getCategory().getName()),
                    p.getSupplier() == null ? null : new Ref(p.getSupplier().getId(), p.getSupplier().getName()),
                    p.getUnit(), p.getUnitPrice(), p.getCostPrice(), p.getTaxRate(), p.getQuantityOnHand(),
                    p.getReorderLevel(), p.isLowStock(), p.isActive(), p.getUpdatedAt(), p.getVersion());
        }
    }

    public record ProductRequest(
            @NotBlank @Size(max = 40) @Pattern(regexp = "[A-Za-z0-9._-]+", message = "Letters, digits, '.', '-' and '_' only")
            String sku,
            @NotBlank @Size(max = 150) String name,
            @Size(max = 1000) String description,
            Long categoryId,
            Long supplierId,
            @NotBlank @Size(max = 20) String unit,
            @NotNull @DecimalMin("0.00") @Digits(integer = 17, fraction = 2) BigDecimal unitPrice,
            @NotNull @DecimalMin("0.00") @Digits(integer = 17, fraction = 2) BigDecimal costPrice,
            @NotNull @DecimalMin("0.00") @DecimalMax("100.00") BigDecimal taxRate,
            @Min(0) @Max(1_000_000) int reorderLevel,
            /** Opening stock, only used on creation; recorded as an ADJUSTMENT movement. */
            @Min(0) @Max(1_000_000) Integer initialQuantity,
            Boolean active,
            Long version) {
    }

    public record StockMovementRequest(
            @NotNull StockMovement.Type type,
            /** RECEIPT/ISSUE: positive amount. ADJUSTMENT: signed correction. */
            @NotNull @Min(-1_000_000) @Max(1_000_000) Integer quantity,
            @DecimalMin("0.00") @Digits(integer = 17, fraction = 2) BigDecimal unitCost,
            Long supplierId,
            @Size(max = 60) String reference,
            @Size(max = 255) String note) {
    }

    public record StockMovementResponse(Long id, Ref product, String sku, StockMovement.Type type, int quantity,
            int quantityAfter, BigDecimal unitCost, Ref supplier, Long salesOrderId, String reference, String note,
            Instant createdAt, String createdBy) {

        public static StockMovementResponse from(StockMovement m) {
            Product p = m.getProduct();
            return new StockMovementResponse(m.getId(), new Ref(p.getId(), p.getName()), p.getSku(), m.getType(),
                    m.getQuantity(), m.getQuantityAfter(), m.getUnitCost(),
                    m.getSupplier() == null ? null : new Ref(m.getSupplier().getId(), m.getSupplier().getName()),
                    m.getSalesOrderId(), m.getReference(), m.getNote(), m.getCreatedAt(), m.getCreatedBy());
        }
    }
}
