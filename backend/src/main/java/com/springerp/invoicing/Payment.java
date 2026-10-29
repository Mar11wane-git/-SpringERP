package com.springerp.invoicing;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

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

/**
 * A payment recorded by accounting staff after money was received outside the
 * system (bank transfer, cash...). No payment provider is integrated or simulated.
 */
@Getter
@Setter
@Entity
@Table(name = "payments")
public class Payment {

    public enum Method { BANK_TRANSFER, CASH, CHECK, CARD, OTHER }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "invoice_id", updatable = false)
    private Invoice invoice;

    @Column(nullable = false, updatable = false)
    private LocalDate paymentDate;

    @Column(nullable = false, precision = 19, scale = 2, updatable = false)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20, updatable = false)
    private Method method;

    @Column(length = 100, updatable = false)
    private String reference;

    @Column(length = 255, updatable = false)
    private String note;

    @Column(length = 150, updatable = false)
    private String recordedBy;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;
}
