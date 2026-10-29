package com.springerp.sales;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import com.springerp.common.persistence.BaseEntity;
import com.springerp.partner.Customer;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "sales_orders")
public class SalesOrder extends BaseEntity {

    /**
     * DRAFT (quote, editable) -> CONFIRMED (stock reserved and shipped out) -> COMPLETED (delivered).
     * DRAFT or CONFIRMED -> CANCELLED (confirmed stock is returned).
     */
    public enum Status { DRAFT, CONFIRMED, COMPLETED, CANCELLED }

    @Column(nullable = false, length = 30, updatable = false)
    private String orderNumber;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "customer_id")
    private Customer customer;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status = Status.DRAFT;

    @Column(nullable = false)
    private LocalDate orderDate;

    @Column(length = 1000)
    private String notes;

    @Column(nullable = false, length = 3)
    private String currency;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal subtotal;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal discountTotal;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal taxTotal;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal total;

    private Instant confirmedAt;
    private Instant completedAt;
    private Instant cancelledAt;

    @Column(length = 150, updatable = false)
    private String createdBy;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("lineNo")
    private List<SalesOrderLine> lines = new ArrayList<>();
}
