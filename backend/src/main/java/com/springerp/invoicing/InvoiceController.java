package com.springerp.invoicing;

import java.time.LocalDate;

import com.springerp.common.api.PageResponse;
import com.springerp.invoicing.InvoiceDtos.CreateInvoiceRequest;
import com.springerp.invoicing.InvoiceDtos.InvoiceResponse;
import com.springerp.invoicing.InvoiceDtos.InvoiceSummary;
import com.springerp.invoicing.InvoiceDtos.PaymentRequest;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Invoices")
@RestController
@RequestMapping("/api/invoices")
@RequiredArgsConstructor
public class InvoiceController {

    private final InvoiceService service;

    @GetMapping
    @PreAuthorize("hasAuthority('INVOICE_READ')")
    public PageResponse<InvoiceSummary> list(@RequestParam(required = false) String search,
            @RequestParam(required = false) Invoice.Status status, @RequestParam(required = false) Long customerId,
            @RequestParam(defaultValue = "false") boolean overdue,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            Pageable pageable) {
        return service.search(search, status, customerId, overdue, from, to, pageable);
    }

    @GetMapping("/export")
    @PreAuthorize("hasAuthority('INVOICE_READ') and hasAuthority('REPORT_READ')")
    public ResponseEntity<byte[]> export(@RequestParam(required = false) String search,
            @RequestParam(required = false) Invoice.Status status, @RequestParam(required = false) Long customerId,
            @RequestParam(defaultValue = "false") boolean overdue,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return service.exportCsv(search, status, customerId, overdue, from, to).toResponse("invoices.csv");
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('INVOICE_READ')")
    public InvoiceResponse get(@PathVariable Long id) {
        return service.get(id);
    }

    @GetMapping(value = "/{id}/pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    @PreAuthorize("hasAuthority('INVOICE_READ')")
    public ResponseEntity<byte[]> pdf(@PathVariable Long id) {
        byte[] pdf = service.pdf(id);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + service.invoiceNumber(id) + ".pdf\"")
                .body(pdf);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('INVOICE_WRITE')")
    public InvoiceResponse create(@Valid @RequestBody CreateInvoiceRequest request) {
        return service.createFromOrder(request);
    }

    @PostMapping("/{id}/payments")
    @PreAuthorize("hasAuthority('PAYMENT_WRITE')")
    public InvoiceResponse recordPayment(@PathVariable Long id, @Valid @RequestBody PaymentRequest request) {
        return service.recordPayment(id, request);
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasAuthority('INVOICE_WRITE')")
    public InvoiceResponse cancel(@PathVariable Long id) {
        return service.cancel(id);
    }
}
