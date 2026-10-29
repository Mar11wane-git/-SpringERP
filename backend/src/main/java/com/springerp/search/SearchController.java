package com.springerp.search;

import java.util.ArrayList;
import java.util.List;

import com.springerp.hr.EmployeeService;
import com.springerp.inventory.ProductService;
import com.springerp.invoicing.InvoiceService;
import com.springerp.partner.CustomerService;
import com.springerp.partner.SupplierService;
import com.springerp.sales.SalesOrderService;
import com.springerp.security.CurrentUser;
import com.springerp.security.Permission;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Global search across modules; each module is searched only if the caller may read it. */
@Tag(name = "Search")
@RestController
@RequestMapping("/api/search")
@RequiredArgsConstructor
public class SearchController {

    private static final int PER_TYPE = 5;

    private final ProductService products;
    private final CustomerService customers;
    private final SupplierService suppliers;
    private final EmployeeService employees;
    private final SalesOrderService orders;
    private final InvoiceService invoices;

    public record SearchHit(String type, Long id, String title, String subtitle, String link) {
    }

    @GetMapping
    public List<SearchHit> search(@RequestParam("q") String query) {
        String q = query == null ? "" : query.trim();
        if (q.length() < 2 || q.length() > 100) {
            return List.of();
        }
        PageRequest page = PageRequest.of(0, PER_TYPE);
        List<SearchHit> hits = new ArrayList<>();
        if (CurrentUser.has(Permission.INVENTORY_READ)) {
            products.search(q, null, null, null, false, page).content().forEach(p -> hits.add(new SearchHit("product",
                    p.id(), p.name(), p.sku() + " · " + p.quantityOnHand() + " " + p.unit(),
                    "/inventory/products/" + p.id())));
        }
        if (CurrentUser.has(Permission.PARTNER_READ)) {
            customers.search(q, null, page).content().forEach(c -> hits.add(new SearchHit("customer", c.id(),
                    c.name(), c.code() + (c.city() == null ? "" : " · " + c.city()), "/customers/" + c.id())));
            suppliers.search(q, null, page).content().forEach(s -> hits.add(new SearchHit("supplier", s.id(),
                    s.name(), s.code() + (s.city() == null ? "" : " · " + s.city()), "/suppliers/" + s.id())));
        }
        if (CurrentUser.has(Permission.EMPLOYEE_READ)) {
            employees.search(q, null, null, page).content().forEach(e -> hits.add(new SearchHit("employee", e.id(),
                    e.fullName(), e.employeeNumber() + " · " + e.jobTitle(), "/employees/" + e.id())));
        }
        if (CurrentUser.has(Permission.SALES_READ)) {
            orders.search(q, null, null, null, null, page).content().forEach(o -> hits.add(new SearchHit("order",
                    o.id(), o.orderNumber(), o.customer().name() + " · " + o.status(), "/sales/orders/" + o.id())));
        }
        if (CurrentUser.has(Permission.INVOICE_READ)) {
            invoices.search(q, null, null, false, null, null, page).content().forEach(i -> hits.add(new SearchHit(
                    "invoice", i.id(), i.invoiceNumber(), i.customer().name() + " · " + i.status(),
                    "/invoices/" + i.id())));
        }
        return hits;
    }
}
