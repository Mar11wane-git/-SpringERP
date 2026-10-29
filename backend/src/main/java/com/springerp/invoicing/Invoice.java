package com.springerp.invoicing;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

import com.springerp.common.persistence.BaseEntity;
import com.springerp.partner.Customer;
import com.springerp.sales.SalesOrder;
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
@Table(name = "invoices")
public class Invoice extends BaseEntity {

    /** ISSUED -> PARTIALLY_PAID -> PAID; ISSUED -> CANCELLED (only while unpaid). "Overdue" is derived. */
    public enum Status { ISSUED, PARTIALLY_PAID, PAID, CANCELLED }

    public static final Set<Status> OPEN = EnumSet.of(Status.ISSUED, Status.PARTIALLY_PAID);

    @Column(nullable = false, length = 30, updatable = false)
    private String invoiceNumber;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sales_order_id", updatable = false)
    private SalesOrder salesOrder;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "customer_id", updatable = false)
    private Customer customer;

    @Column(nullable = false, length = 150, updatable = false)
    private String billToName;

    @Column(length = 500, updatable = false)
    private String billToAddress;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status = Status.ISSUED;

    @Column(nullable = false, updatable = false)
    private LocalDate issueDate;

    @Column(nullable = false)
    private LocalDate dueDate;

    @Column(nullable = false, length = 3, updatable = false)
    private String currency;

    @Column(nullable = false, precision = 19, scale = 2, updatable = false)
    private BigDecimal subtotal;

    @Column(nullable = false, precision = 19, scale = 2, updatable = false)
    private BigDecimal discountTotal;

    @Column(nullable = false, precision = 19, scale = 2, updatable = false)
    private BigDecimal taxTotal;

    @Column(nullable = false, precision = 19, scale = 2, updatable = false)
    private BigDecimal total;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal amountPaid = BigDecimal.ZERO.setScale(2);

    @Column(length = 1000)
    private String notes;

    private Instant cancelledAt;

    @OneToMany(mappedBy = "invoice", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("lineNo")
    private List<InvoiceLine> lines = new ArrayList<>();

    public BigDecimal balanceDue() {
        return status == Status.CANCELLED ? BigDecimal.ZERO.setScale(2) : total.subtract(amountPaid);
    }

    public boolean isOverdue(LocalDate today) {
        return OPEN.contains(status) && dueDate.isBefore(today);
    }
}
