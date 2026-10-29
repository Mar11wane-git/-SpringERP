package com.springerp.company;

import java.math.BigDecimal;
import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.UpdateTimestamp;

/** Single-row table (id = 1) holding the company profile and defaults. */
@Getter
@Setter
@Entity
@Table(name = "company_settings")
public class CompanySettings {

    public static final long SINGLETON_ID = 1L;

    @Id
    private Long id;

    @Column(nullable = false, length = 150)
    private String name;

    private String legalName;
    private String taxId;
    private String email;
    private String phone;
    private String addressLine;
    private String city;
    private String postalCode;
    private String country;

    @Column(nullable = false, length = 3)
    private String currency;

    @Column(nullable = false, length = 60)
    private String timezone;

    @Column(nullable = false, precision = 5, scale = 2)
    private BigDecimal defaultTaxRate;

    @Column(nullable = false)
    private int paymentTermsDays;

    private String invoiceFooter;

    @UpdateTimestamp
    @Column(nullable = false)
    private Instant updatedAt;

    @Version
    private long version;

    /** Single-line postal address for documents. */
    public String formattedAddress() {
        return java.util.stream.Stream.of(addressLine, postalCode, city, country)
                .filter(s -> s != null && !s.isBlank())
                .reduce((a, b) -> a + ", " + b)
                .orElse("");
    }
}
