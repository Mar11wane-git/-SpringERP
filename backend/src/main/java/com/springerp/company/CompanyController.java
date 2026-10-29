package com.springerp.company;

import com.springerp.company.CompanyService.CompanyRequest;
import com.springerp.company.CompanyService.CompanyResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Company")
@RestController
@RequestMapping("/api/company")
@RequiredArgsConstructor
public class CompanyController {

    private final CompanyService service;

    /** Readable by every signed-in user: currency and company name are needed across the UI. */
    @GetMapping
    public CompanyResponse get() {
        return service.get();
    }

    @PutMapping
    @PreAuthorize("hasAuthority('COMPANY_WRITE')")
    public CompanyResponse update(@Valid @RequestBody CompanyRequest request) {
        return service.update(request);
    }
}
