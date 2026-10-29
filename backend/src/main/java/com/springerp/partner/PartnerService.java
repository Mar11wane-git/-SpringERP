package com.springerp.partner;

import java.util.Set;
import java.util.function.Supplier;

import com.springerp.audit.AuditAction;
import com.springerp.audit.AuditService;
import com.springerp.common.api.PageResponse;
import com.springerp.common.api.Pagination;
import com.springerp.common.error.BusinessException;
import com.springerp.common.error.NotFoundException;
import com.springerp.numbering.DocumentNumberService;
import com.springerp.partner.PartnerDtos.PartnerRequest;
import com.springerp.partner.PartnerDtos.PartnerResponse;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.transaction.annotation.Transactional;

/** Shared customer/supplier logic: validation, duplicate detection, numbering and auditing. */
public abstract class PartnerService<E extends Partner> {

    private static final Set<String> SORTABLE = Set.of("code", "name", "city", "createdAt");

    private final PartnerRepository<E> repository;
    private final DocumentNumberService numbers;
    private final AuditService audit;
    private final Supplier<E> factory;
    private final String label;
    private final String codePrefix;

    protected PartnerService(PartnerRepository<E> repository, DocumentNumberService numbers, AuditService audit,
            Supplier<E> factory, String label, String codePrefix) {
        this.repository = repository;
        this.numbers = numbers;
        this.audit = audit;
        this.factory = factory;
        this.label = label;
        this.codePrefix = codePrefix;
    }

    @Transactional(readOnly = true)
    public PageResponse<PartnerResponse> search(String search, Boolean active, Pageable pageable) {
        Pageable page = Pagination.sanitize(pageable, SORTABLE, Sort.by("name"));
        return PageResponse.of(repository.search(Pagination.likePattern(search), active, page), PartnerResponse::from);
    }

    @Transactional(readOnly = true)
    public PartnerResponse get(Long id) {
        return PartnerResponse.from(find(id));
    }

    @Transactional
    public PartnerResponse create(PartnerRequest request) {
        E partner = factory.get();
        apply(partner, request);
        partner.setCode(numbers.next(codePrefix));
        repository.save(partner);
        audit.record(AuditAction.PARTNER_SAVED, label, partner.getId(),
                "Created " + label.toLowerCase() + " " + partner.getCode() + " " + partner.getName());
        return PartnerResponse.from(partner);
    }

    @Transactional
    public PartnerResponse update(Long id, PartnerRequest request) {
        E partner = find(id);
        if (request.version() != null && request.version() != partner.getVersion()) {
            throw new ObjectOptimisticLockingFailureException(partner.getClass(), id);
        }
        apply(partner, request);
        audit.record(AuditAction.PARTNER_SAVED, label, id, "Updated " + label.toLowerCase() + " " + partner.getName());
        return PartnerResponse.from(partner);
    }

    public E find(Long id) {
        return repository.findById(id).orElseThrow(() -> new NotFoundException(label, id));
    }

    private void apply(E p, PartnerRequest r) {
        Long id = p.getId() == null ? -1L : p.getId();
        String email = blankToNull(r.email());
        String taxId = blankToNull(r.taxId());
        String city = blankToNull(r.city());
        if (email != null && repository.existsByEmailIgnoreCaseAndIdNot(email, id)) {
            throw BusinessException.conflict("DUPLICATE_EMAIL", "Another " + label.toLowerCase() + " uses this email.");
        }
        if (taxId != null && repository.existsByTaxIdIgnoreCaseAndIdNot(taxId, id)) {
            throw BusinessException.conflict("DUPLICATE_TAX_ID", "Another " + label.toLowerCase() + " uses this tax id.");
        }
        if (!r.ignoreDuplicateWarning() && !repository.findPossibleDuplicates(r.name().trim(), city, id).isEmpty()) {
            throw BusinessException.conflict("POSSIBLE_DUPLICATE", "A " + label.toLowerCase()
                    + " with the same name" + (city == null ? "" : " in " + city) + " already exists.");
        }
        p.setName(r.name().trim());
        p.setContactName(blankToNull(r.contactName()));
        p.setEmail(email == null ? null : email.toLowerCase());
        p.setPhone(blankToNull(r.phone()));
        p.setTaxId(taxId);
        p.setAddressLine(blankToNull(r.addressLine()));
        p.setCity(city);
        p.setPostalCode(blankToNull(r.postalCode()));
        p.setCountry(blankToNull(r.country()));
        p.setNotes(blankToNull(r.notes()));
        if (r.active() != null) {
            p.setActive(r.active());
        }
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
