package com.springerp.company;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.DateTimeException;
import java.time.LocalDate;
import java.time.ZoneId;

import com.springerp.audit.AuditAction;
import com.springerp.audit.AuditService;
import com.springerp.common.error.BusinessException;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CompanyService {

    private final CompanySettingsRepository repository;
    private final AuditService audit;
    private final Clock clock;

    public record CompanyResponse(String name, String legalName, String taxId, String email, String phone,
            String addressLine, String city, String postalCode, String country, String currency, String timezone,
            BigDecimal defaultTaxRate, int paymentTermsDays, String invoiceFooter, long version) {

        static CompanyResponse from(CompanySettings c) {
            return new CompanyResponse(c.getName(), c.getLegalName(), c.getTaxId(), c.getEmail(), c.getPhone(),
                    c.getAddressLine(), c.getCity(), c.getPostalCode(), c.getCountry(), c.getCurrency(),
                    c.getTimezone(), c.getDefaultTaxRate(), c.getPaymentTermsDays(), c.getInvoiceFooter(),
                    c.getVersion());
        }
    }

    public record CompanyRequest(
            @NotBlank @Size(max = 150) String name,
            @Size(max = 200) String legalName,
            @Size(max = 50) String taxId,
            @Email @Size(max = 150) String email,
            @Size(max = 40) String phone,
            @Size(max = 200) String addressLine,
            @Size(max = 100) String city,
            @Size(max = 20) String postalCode,
            @Size(max = 100) String country,
            @NotBlank @Pattern(regexp = "[A-Z]{3}", message = "Use a 3-letter ISO currency code") String currency,
            @NotBlank @Size(max = 60) String timezone,
            @NotNull @DecimalMin("0.00") @DecimalMax("100.00") BigDecimal defaultTaxRate,
            @Min(0) @Max(365) int paymentTermsDays,
            @Size(max = 500) String invoiceFooter,
            @NotNull Long version) {
    }

    @Transactional(readOnly = true)
    public CompanySettings current() {
        return repository.findById(CompanySettings.SINGLETON_ID)
                .orElseThrow(() -> new IllegalStateException("company_settings row is missing"));
    }

    @Transactional(readOnly = true)
    public CompanyResponse get() {
        return CompanyResponse.from(current());
    }

    /** "Today" in the company's time zone, used for business dates (orders, invoices, overdue checks). */
    @Transactional(readOnly = true)
    public LocalDate today() {
        return LocalDate.now(clock.withZone(ZoneId.of(current().getTimezone())));
    }

    @Transactional
    public CompanyResponse update(CompanyRequest r) {
        try {
            ZoneId.of(r.timezone());
        } catch (DateTimeException e) {
            throw BusinessException.rule("INVALID_TIMEZONE", "Unknown time zone: " + r.timezone());
        }
        CompanySettings c = current();
        if (c.getVersion() != r.version()) {
            throw new ObjectOptimisticLockingFailureException(CompanySettings.class, c.getId());
        }
        c.setName(r.name().trim());
        c.setLegalName(r.legalName());
        c.setTaxId(r.taxId());
        c.setEmail(r.email());
        c.setPhone(r.phone());
        c.setAddressLine(r.addressLine());
        c.setCity(r.city());
        c.setPostalCode(r.postalCode());
        c.setCountry(r.country());
        c.setCurrency(r.currency());
        c.setTimezone(r.timezone());
        c.setDefaultTaxRate(r.defaultTaxRate());
        c.setPaymentTermsDays(r.paymentTermsDays());
        c.setInvoiceFooter(r.invoiceFooter());
        repository.flush();
        audit.record(AuditAction.COMPANY_UPDATED, "Company", c.getId(), "Company settings updated");
        return CompanyResponse.from(c);
    }
}
