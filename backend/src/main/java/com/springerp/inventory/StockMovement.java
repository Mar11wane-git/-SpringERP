package com.springerp.inventory;

import java.math.BigDecimal;
import java.time.Instant;

import com.springerp.partner.Supplier;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

/** Immutable ledger entry. {@code quantity} is a signed delta. */
@Getter
@Setter
@Entity
@Table(name = "stock_movements")
public class StockMovement {

    public enum Type {
        /** Goods received from a supplier (+). */
        RECEIPT,
        /** Goods taken out for internal use, loss or damage (-). */
        ISSUE,
        /** Correction after a physical count (+/-). */
        ADJUSTMENT,
        /** Shipped against a confirmed sales order (-). */
        SALE,
        /** Returned to stock when a confirmed order is cancelled (+). */
        SALE_REVERSAL
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", updatable = false)
    private Product product;

    @Enumerated(EnumType.STRING)
    @Column(name = "movement_type", nullable = false, updatable = false, length = 20)
    private Type type;

    @Column(nullable = false, updatable = false)
    private int quantity;

    @Column(nullable = false, updatable = false)
    private int quantityAfter;

    @Column(precision = 19, scale = 2, updatable = false)
    private BigDecimal unitCost;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supplier_id", updatable = false)
    private Supplier supplier;

    @Column(updatable = false)
    private Long salesOrderId;

    @Column(length = 60, updatable = false)
    private String reference;

    @Column(length = 255, updatable = false)
    private String note;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(length = 150, updatable = false)
    private String createdBy;
}
