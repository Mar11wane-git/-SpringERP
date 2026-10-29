package com.springerp.partner;

import java.time.Instant;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class PartnerDtos {

    private PartnerDtos() {
    }

    public record PartnerResponse(Long id, String code, String name, String contactName, String email, String phone,
            String taxId, String addressLine, String city, String postalCode, String country, String notes,
            boolean active, Instant createdAt, long version) {

        public static PartnerResponse from(Partner p) {
            return new PartnerResponse(p.getId(), p.getCode(), p.getName(), p.getContactName(), p.getEmail(),
                    p.getPhone(), p.getTaxId(), p.getAddressLine(), p.getCity(), p.getPostalCode(), p.getCountry(),
                    p.getNotes(), p.isActive(), p.getCreatedAt(), p.getVersion());
        }
    }

    public record PartnerRequest(
            @NotBlank @Size(max = 150) String name,
            @Size(max = 150) String contactName,
            @Email @Size(max = 150) String email,
            @Size(max = 40) String phone,
            @Size(max = 50) String taxId,
            @Size(max = 200) String addressLine,
            @Size(max = 100) String city,
            @Size(max = 20) String postalCode,
            @Size(max = 100) String country,
            @Size(max = 1000) String notes,
            Boolean active,
            /** Set to true to save even though a likely duplicate (same name and city) exists. */
            boolean ignoreDuplicateWarning,
            Long version) {
    }
}
