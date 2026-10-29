package com.springerp.inventory;

import java.math.BigDecimal;

import com.springerp.common.persistence.BaseEntity;
import com.springerp.partner.Supplier;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "products")
public class Product extends BaseEntity {

    @Column(nullable = false, length = 40)
    private String sku;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(length = 1000)
    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private Category category;

    /** Preferred supplier for replenishment. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supplier_id")
    private Supplier supplier;

    @Column(nullable = false, length = 20)
    private String unit;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal unitPrice;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal costPrice;

    @Column(nullable = false, precision = 5, scale = 2)
    private BigDecimal taxRate;

    /** Only changed through StockService, which records a movement for every change. */
    @Setter(AccessLevel.PACKAGE)
    @Column(nullable = false)
    private int quantityOnHand;

    @Column(nullable = false)
    private int reorderLevel;

    private boolean active = true;

    public boolean isLowStock() {
        return quantityOnHand <= reorderLevel;
    }
}
