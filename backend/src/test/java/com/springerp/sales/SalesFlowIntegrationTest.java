package com.springerp.sales;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;
import com.springerp.security.Role;
import com.springerp.support.IntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** End-to-end business flow through the REST API: order -> stock -> invoice -> payments. */
class SalesFlowIntegrationTest extends IntegrationTest {

    private String admin;

    @BeforeEach
    void setUp() {
        admin = tokenFor(Role.ADMIN);
    }

    @Test
    void orderToCashFlow() throws Exception {
        long customer = createCustomer(admin);
        long product = createProduct(admin, 10, "25.00");

        // Draft order: 4 x 25.00, 10% discount, 20% tax => 100 - 10 = 90 net, 18 tax, 108 total
        JsonNode order = read(mvc.perform(jsonBody(auth(post("/api/sales-orders"), admin), Map.of(
                        "customerId", customer,
                        "lines", List.of(Map.of("productId", product, "quantity", 4, "discountPercent", 10)))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.subtotal").value(100.00))
                .andExpect(jsonPath("$.discountTotal").value(10.00))
                .andExpect(jsonPath("$.taxTotal").value(18.00))
                .andExpect(jsonPath("$.total").value(108.00)));
        long orderId = order.get("id").asLong();

        // Drafts cannot be invoiced and do not touch stock.
        mvc.perform(jsonBody(auth(post("/api/invoices"), admin), Map.of("salesOrderId", orderId)))
                .andExpect(status().isConflict());
        stockShouldBe(product, 10);

        mvc.perform(auth(post("/api/sales-orders/" + orderId + "/confirm"), admin))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CONFIRMED"));
        stockShouldBe(product, 6);

        JsonNode invoice = read(mvc.perform(jsonBody(auth(post("/api/invoices"), admin), Map.of("salesOrderId", orderId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.invoiceNumber").value(org.hamcrest.Matchers.matchesPattern("INV-\\d{4}-\\d{5}")))
                .andExpect(jsonPath("$.total").value(108.00))
                .andExpect(jsonPath("$.balanceDue").value(108.00)));
        long invoiceId = invoice.get("id").asLong();

        // Only one active invoice per order; the order can no longer be cancelled.
        mvc.perform(jsonBody(auth(post("/api/invoices"), admin), Map.of("salesOrderId", orderId)))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("ORDER_ALREADY_INVOICED"));
        mvc.perform(auth(post("/api/sales-orders/" + orderId + "/cancel"), admin))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("ORDER_INVOICED"));

        // Partial payment, then an overpayment attempt, then the exact balance.
        mvc.perform(jsonBody(auth(post("/api/invoices/" + invoiceId + "/payments"), admin),
                        Map.of("amount", 50.00, "method", "BANK_TRANSFER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PARTIALLY_PAID"))
                .andExpect(jsonPath("$.balanceDue").value(58.00));
        mvc.perform(jsonBody(auth(post("/api/invoices/" + invoiceId + "/payments"), admin),
                        Map.of("amount", 58.01, "method", "CASH")))
                .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("OVERPAYMENT"));
        mvc.perform(jsonBody(auth(post("/api/invoices/" + invoiceId + "/payments"), admin),
                        Map.of("amount", 58.00, "method", "CASH")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PAID"))
                .andExpect(jsonPath("$.balanceDue").value(0.00))
                .andExpect(jsonPath("$.payments.length()").value(2));

        // Paid invoices cannot be cancelled; the printable PDF is available.
        mvc.perform(auth(post("/api/invoices/" + invoiceId + "/cancel"), admin)).andExpect(status().isConflict());
        mvc.perform(auth(get("/api/invoices/" + invoiceId + "/pdf"), admin))
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/pdf"));
    }

    @Test
    void insufficientStockRejectsConfirmationAtomically() throws Exception {
        long customer = createCustomer(admin);
        long plenty = createProduct(admin, 50, "5.00");
        long scarce = createProduct(admin, 1, "5.00");
        long orderId = read(mvc.perform(jsonBody(auth(post("/api/sales-orders"), admin), Map.of(
                "customerId", customer,
                "lines", List.of(Map.of("productId", plenty, "quantity", 5),
                        Map.of("productId", scarce, "quantity", 3)))))).get("id").asLong();

        mvc.perform(auth(post("/api/sales-orders/" + orderId + "/confirm"), admin))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("INSUFFICIENT_STOCK"));

        // Neither line was applied: the transaction rolled back as a whole.
        stockShouldBe(plenty, 50);
        stockShouldBe(scarce, 1);
        mvc.perform(auth(get("/api/sales-orders/" + orderId), admin)).andExpect(jsonPath("$.status").value("DRAFT"));
    }

    @Test
    void cancellingConfirmedOrderReturnsStock() throws Exception {
        long customer = createCustomer(admin);
        long product = createProduct(admin, 8, "3.00");
        long orderId = read(mvc.perform(jsonBody(auth(post("/api/sales-orders"), admin), Map.of(
                "customerId", customer, "lines", List.of(Map.of("productId", product, "quantity", 5))))))
                .get("id").asLong();
        mvc.perform(auth(post("/api/sales-orders/" + orderId + "/confirm"), admin)).andExpect(status().isOk());
        stockShouldBe(product, 3);

        mvc.perform(auth(post("/api/sales-orders/" + orderId + "/cancel"), admin))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CANCELLED"));
        stockShouldBe(product, 8);

        // The ledger shows the opening balance, the sale and its reversal.
        mvc.perform(auth(get("/api/products/" + product + "/stock-movements"), admin))
                .andExpect(jsonPath("$.totalElements").value(3));
    }

    @Test
    void stockCannotGoNegativeThroughManualIssue() throws Exception {
        long product = createProduct(admin, 2, "3.00");
        mvc.perform(jsonBody(auth(post("/api/products/" + product + "/stock-movements"), admin),
                        Map.of("type", "ISSUE", "quantity", 3)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("INSUFFICIENT_STOCK"));
        mvc.perform(jsonBody(auth(post("/api/products/" + product + "/stock-movements"), admin),
                        Map.of("type", "SALE", "quantity", 1)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("RESERVED_MOVEMENT_TYPE"));
        stockShouldBe(product, 2);
    }

    @Test
    void staleVersionIsRejectedAsConcurrentModification() throws Exception {
        long product = createProduct(admin, 0, "3.00");
        JsonNode p = read(mvc.perform(auth(get("/api/products/" + product), admin)));
        Map<String, Object> update = new java.util.HashMap<>(Map.of("sku", p.get("sku").asText(), "name", "Renamed",
                "unit", "pcs", "unitPrice", 4, "costPrice", 1, "taxRate", 20, "reorderLevel", 1));
        update.put("version", p.get("version").asLong());
        mvc.perform(jsonBody(auth(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                .put("/api/products/" + product), admin), update)).andExpect(status().isOk());
        // Second save with the same (now stale) version.
        mvc.perform(jsonBody(auth(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .put("/api/products/" + product), admin), update))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONCURRENT_MODIFICATION"));
    }

    private void stockShouldBe(long productId, int expected) throws Exception {
        mvc.perform(auth(get("/api/products/" + productId), admin))
                .andExpect(jsonPath("$.quantityOnHand").value(expected));
    }
}
