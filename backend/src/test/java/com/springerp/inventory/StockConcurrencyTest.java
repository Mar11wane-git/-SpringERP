package com.springerp.inventory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import com.springerp.security.Role;
import com.springerp.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Many clerks issuing the same product at the same moment must never oversell:
 * the row lock in StockService serializes them and the ledger stays consistent.
 */
class StockConcurrencyTest extends IntegrationTest {

    @Autowired
    private ProductRepository products;

    @Autowired
    private StockMovementRepository movements;

    @Test
    void concurrentIssuesNeverDriveStockNegative() throws Exception {
        String admin = tokenFor(Role.ADMIN);
        long productId = createProduct(admin, 5, "2.00");
        int threads = 12;
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        List<Future<Integer>> results = new ArrayList<>();
        Callable<Integer> issueOne = () -> {
            start.await();
            return mvc.perform(jsonBody(auth(post("/api/products/" + productId + "/stock-movements"), admin),
                    Map.of("type", "ISSUE", "quantity", 1))).andReturn().getResponse().getStatus();
        };
        for (int i = 0; i < threads; i++) {
            results.add(pool.submit(issueOne));
        }
        start.countDown();
        int succeeded = 0;
        int rejected = 0;
        for (Future<Integer> f : results) {
            int status = f.get();
            if (status == 201) {
                succeeded++;
            } else if (status == 422) {
                rejected++;
            }
        }
        pool.shutdown();

        assertThat(succeeded).isEqualTo(5);
        assertThat(rejected).isEqualTo(threads - 5);
        assertThat(products.findById(productId).orElseThrow().getQuantityOnHand()).isZero();
        long issues = movements.search(productId, StockMovement.Type.ISSUE, null, null,
                org.springframework.data.domain.PageRequest.of(0, 50)).getTotalElements();
        assertThat(issues).isEqualTo(5);
    }
}
