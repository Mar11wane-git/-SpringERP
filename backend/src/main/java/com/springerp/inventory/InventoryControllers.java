package com.springerp.inventory;

import java.time.LocalDate;
import java.util.List;

import com.springerp.common.api.PageResponse;
import com.springerp.inventory.InventoryDtos.CategoryRequest;
import com.springerp.inventory.InventoryDtos.CategoryResponse;
import com.springerp.inventory.InventoryDtos.ProductRequest;
import com.springerp.inventory.InventoryDtos.ProductResponse;
import com.springerp.inventory.InventoryDtos.StockMovementRequest;
import com.springerp.inventory.InventoryDtos.StockMovementResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

final class InventoryControllers {

    private InventoryControllers() {
    }

    @Tag(name = "Categories")
    @RestController
    @RequestMapping("/api/categories")
    @RequiredArgsConstructor
    static class CategoryController {

        private final ProductService service;

        @GetMapping
        @PreAuthorize("hasAuthority('INVENTORY_READ')")
        public List<CategoryResponse> list() {
            return service.listCategories();
        }

        @PostMapping
        @ResponseStatus(HttpStatus.CREATED)
        @PreAuthorize("hasAuthority('INVENTORY_WRITE')")
        public CategoryResponse create(@Valid @RequestBody CategoryRequest request) {
            return service.saveCategory(null, request);
        }

        @PutMapping("/{id}")
        @PreAuthorize("hasAuthority('INVENTORY_WRITE')")
        public CategoryResponse update(@PathVariable Long id, @Valid @RequestBody CategoryRequest request) {
            return service.saveCategory(id, request);
        }

        @DeleteMapping("/{id}")
        @ResponseStatus(HttpStatus.NO_CONTENT)
        @PreAuthorize("hasAuthority('INVENTORY_WRITE')")
        public void delete(@PathVariable Long id) {
            service.deleteCategory(id);
        }
    }

    @Tag(name = "Products")
    @RestController
    @RequestMapping("/api/products")
    @RequiredArgsConstructor
    static class ProductController {

        private final ProductService service;
        private final StockService stock;

        @GetMapping
        @PreAuthorize("hasAuthority('INVENTORY_READ')")
        public PageResponse<ProductResponse> list(@RequestParam(required = false) String search,
                @RequestParam(required = false) Long categoryId, @RequestParam(required = false) Long supplierId,
                @RequestParam(required = false) Boolean active,
                @RequestParam(defaultValue = "false") boolean lowStock, Pageable pageable) {
            return service.search(search, categoryId, supplierId, active, lowStock, pageable);
        }

        @GetMapping("/export")
        @PreAuthorize("hasAuthority('INVENTORY_READ') and hasAuthority('REPORT_READ')")
        public ResponseEntity<byte[]> export(@RequestParam(required = false) String search,
                @RequestParam(required = false) Long categoryId, @RequestParam(required = false) Long supplierId,
                @RequestParam(required = false) Boolean active,
                @RequestParam(defaultValue = "false") boolean lowStock) {
            return service.exportCsv(search, categoryId, supplierId, active, lowStock).toResponse("products.csv");
        }

        @GetMapping("/{id}")
        @PreAuthorize("hasAuthority('INVENTORY_READ')")
        public ProductResponse get(@PathVariable Long id) {
            return service.get(id);
        }

        @PostMapping
        @ResponseStatus(HttpStatus.CREATED)
        @PreAuthorize("hasAuthority('INVENTORY_WRITE')")
        public ProductResponse create(@Valid @RequestBody ProductRequest request) {
            return service.create(request);
        }

        @PutMapping("/{id}")
        @PreAuthorize("hasAuthority('INVENTORY_WRITE')")
        public ProductResponse update(@PathVariable Long id, @Valid @RequestBody ProductRequest request) {
            return service.update(id, request);
        }

        @GetMapping("/{id}/stock-movements")
        @PreAuthorize("hasAuthority('INVENTORY_READ')")
        public PageResponse<StockMovementResponse> movements(@PathVariable Long id, Pageable pageable) {
            return stock.search(id, null, null, null, pageable);
        }

        /** Fine-grained check (receipt vs. issue/adjustment) happens in StockService. */
        @PostMapping("/{id}/stock-movements")
        @ResponseStatus(HttpStatus.CREATED)
        @PreAuthorize("hasAnyAuthority('INVENTORY_WRITE', 'STOCK_ADJUST')")
        public StockMovementResponse recordMovement(@PathVariable Long id,
                @Valid @RequestBody StockMovementRequest request) {
            return stock.record(id, request);
        }
    }

    @Tag(name = "Stock movements")
    @RestController
    @RequestMapping("/api/stock-movements")
    @RequiredArgsConstructor
    static class StockMovementController {

        private final StockService stock;

        @GetMapping
        @PreAuthorize("hasAuthority('INVENTORY_READ')")
        public PageResponse<StockMovementResponse> list(@RequestParam(required = false) Long productId,
                @RequestParam(required = false) StockMovement.Type type,
                @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                Pageable pageable) {
            return stock.search(productId, type, from, to, pageable);
        }
    }
}
