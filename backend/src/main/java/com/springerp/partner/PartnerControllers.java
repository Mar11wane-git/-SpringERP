package com.springerp.partner;

import com.springerp.common.api.PageResponse;
import com.springerp.partner.PartnerDtos.PartnerRequest;
import com.springerp.partner.PartnerDtos.PartnerResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Customers and suppliers expose the same REST contract under different paths. */
final class PartnerControllers {

    private PartnerControllers() {
    }

    abstract static class BasePartnerController<E extends Partner> {

        private final PartnerService<E> service;

        BasePartnerController(PartnerService<E> service) {
            this.service = service;
        }

        @GetMapping
        @PreAuthorize("hasAuthority('PARTNER_READ')")
        public PageResponse<PartnerResponse> list(@RequestParam(required = false) String search,
                @RequestParam(required = false) Boolean active, Pageable pageable) {
            return service.search(search, active, pageable);
        }

        @GetMapping("/{id}")
        @PreAuthorize("hasAuthority('PARTNER_READ')")
        public PartnerResponse get(@PathVariable Long id) {
            return service.get(id);
        }

        @PostMapping
        @ResponseStatus(HttpStatus.CREATED)
        @PreAuthorize("hasAuthority('PARTNER_WRITE')")
        public PartnerResponse create(@Valid @RequestBody PartnerRequest request) {
            return service.create(request);
        }

        @PutMapping("/{id}")
        @PreAuthorize("hasAuthority('PARTNER_WRITE')")
        public PartnerResponse update(@PathVariable Long id, @Valid @RequestBody PartnerRequest request) {
            return service.update(id, request);
        }
    }

    @Tag(name = "Customers")
    @RestController
    @RequestMapping("/api/customers")
    static class CustomerController extends BasePartnerController<Customer> {
        CustomerController(CustomerService service) {
            super(service);
        }
    }

    @Tag(name = "Suppliers")
    @RestController
    @RequestMapping("/api/suppliers")
    static class SupplierController extends BasePartnerController<Supplier> {
        SupplierController(SupplierService service) {
            super(service);
        }
    }
}
