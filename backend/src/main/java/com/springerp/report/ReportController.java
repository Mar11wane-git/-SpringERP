package com.springerp.report;

import java.time.LocalDate;

import com.springerp.report.ReportService.HrReport;
import com.springerp.report.ReportService.InventoryReport;
import com.springerp.report.ReportService.SalesReport;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Reports")
@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportService service;

    /** Revenue figures are sensitive: requires the financial reporting permission. */
    @GetMapping("/sales")
    @PreAuthorize("hasAuthority('REPORT_FINANCIAL')")
    public SalesReport sales(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return service.sales(from, to);
    }

    @GetMapping("/sales/export")
    @PreAuthorize("hasAuthority('REPORT_FINANCIAL')")
    public ResponseEntity<byte[]> salesCsv(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return service.salesCsv(from, to).toResponse("sales-report.csv");
    }

    @GetMapping("/inventory")
    @PreAuthorize("hasAuthority('REPORT_READ') and hasAuthority('INVENTORY_READ')")
    public InventoryReport inventory() {
        return service.inventory();
    }

    @GetMapping("/inventory/export")
    @PreAuthorize("hasAuthority('REPORT_READ') and hasAuthority('INVENTORY_READ')")
    public ResponseEntity<byte[]> inventoryCsv() {
        return service.inventoryCsv().toResponse("inventory-valuation.csv");
    }

    @GetMapping("/hr")
    @PreAuthorize("hasAuthority('REPORT_READ') and hasAuthority('EMPLOYEE_READ')")
    public HrReport hr() {
        return service.hr();
    }
}
