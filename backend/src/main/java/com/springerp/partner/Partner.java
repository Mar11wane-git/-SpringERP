package com.springerp.partner;

import com.springerp.common.persistence.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import lombok.Getter;
import lombok.Setter;

/** Shared shape of customers and suppliers (separate tables, identical columns). */
@Getter
@Setter
@MappedSuperclass
public abstract class Partner extends BaseEntity {

    @Column(nullable = false, length = 20, updatable = false)
    private String code;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(length = 150)
    private String contactName;

    @Column(length = 150)
    private String email;

    @Column(length = 40)
    private String phone;

    @Column(length = 50)
    private String taxId;

    @Column(length = 200)
    private String addressLine;

    @Column(length = 100)
    private String city;

    @Column(length = 20)
    private String postalCode;

    @Column(length = 100)
    private String country;

    @Column(length = 1000)
    private String notes;

    private boolean active = true;

    public String formattedAddress() {
        return java.util.stream.Stream.of(addressLine, postalCode, city, country)
                .filter(s -> s != null && !s.isBlank())
                .reduce((a, b) -> a + ", " + b)
                .orElse(null);
    }
}
