package com.springerp.inventory;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.springerp.audit.AuditAction;
import com.springerp.audit.AuditService;
import com.springerp.common.api.PageResponse;
import com.springerp.common.api.Pagination;
import com.springerp.common.error.BusinessException;
import com.springerp.common.error.NotFoundException;
import com.springerp.inventory.InventoryDtos.CategoryRequest;
import com.springerp.inventory.InventoryDtos.CategoryResponse;
import com.springerp.inventory.InventoryDtos.ProductRequest;
import com.springerp.inventory.InventoryDtos.ProductResponse;
import com.springerp.common.web.CsvWriter;
import com.springerp.partner.SupplierService;
import com.springerp.report.ExportAuditor;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ProductService {

    private static final Set<String> SORTABLE =
            Set.of("sku", "name", "unitPrice", "quantityOnHand", "reorderLevel", "updatedAt");

    private final ProductRepository products;
    private final CategoryRepository categories;
    private final SupplierService suppliers;
    private final StockService stock;
    private final AuditService audit;
    private final ExportAuditor exportAuditor;

    // ---- Categories ----

    @Transactional(readOnly = true)
    public List<CategoryResponse> listCategories() {
        Map<Long, Long> counts = new HashMap<>();
        categories.countProductsByCategory().forEach(r -> counts.put((Long) r[0], (Long) r[1]));
        return categories.findAllByOrderByNameAsc().stream()
                .map(c -> new CategoryResponse(c.getId(), c.getName(), c.getDescription(),
                        counts.getOrDefault(c.getId(), 0L), c.getVersion()))
                .toList();
    }

    @Transactional
    public CategoryResponse saveCategory(Long id, CategoryRequest r) {
        Category c = id == null ? new Category()
                : categories.findById(id).orElseThrow(() -> new NotFoundException("Category", id));
        if (id != null && r.version() != null && r.version() != c.getVersion()) {
            throw new ObjectOptimisticLockingFailureException(Category.class, id);
        }
        if (categories.existsByNameIgnoreCaseAndIdNot(r.name().trim(), id == null ? -1L : id)) {
            throw BusinessException.conflict("DUPLICATE_NAME", "A category with this name already exists.");
        }
        c.setName(r.name().trim());
        c.setDescription(r.description());
        categories.save(c);
        return new CategoryResponse(c.getId(), c.getName(), c.getDescription(), 0, c.getVersion());
    }

    @Transactional
    public void deleteCategory(Long id) {
        Category c = categories.findById(id).orElseThrow(() -> new NotFoundException("Category", id));
        if (products.existsByCategoryId(id)) {
            throw BusinessException.conflict("CATEGORY_IN_USE", "Move or archive its products before deleting it.");
        }
        categories.delete(c);
    }

    // ---- Products ----

    @Transactional(readOnly = true)
    public PageResponse<ProductResponse> search(String search, Long categoryId, Long supplierId, Boolean active,
            boolean lowStock,
            Pageable pageable) {
        Pageable page = Pagination.sanitize(pageable, SORTABLE, Sort.by("name"));
        return PageResponse.of(products.search(Pagination.likePattern(search), categoryId, supplierId, active, lowStock, page),
                ProductResponse::from);
    }

    @Transactional(readOnly = true)
    public ProductResponse get(Long id) {
        return ProductResponse.from(find(id));
    }

    @Transactional
    public ProductResponse create(ProductRequest r) {
        Product p = new Product();
        apply(p, r);
        products.saveAndFlush(p);
        if (r.initialQuantity() != null && r.initialQuantity() > 0) {
            stock.apply(p.getId(), StockMovement.Type.ADJUSTMENT, r.initialQuantity(), null, null, null,
                    "OPENING", "Opening balance");
        }
        audit.record(AuditAction.PRODUCT_SAVED, "Product", p.getId(), "Created product " + p.getSku());
        return ProductResponse.from(p);
    }

    @Transactional
    public ProductResponse update(Long id, ProductRequest r) {
        Product p = find(id);
        if (r.version() != null && r.version() != p.getVersion()) {
            throw new ObjectOptimisticLockingFailureException(Product.class, id);
        }
        apply(p, r);
        audit.record(AuditAction.PRODUCT_SAVED, "Product", id, "Updated product " + p.getSku());
        return ProductResponse.from(p);
    }

    private void apply(Product p, ProductRequest r) {
        String sku = r.sku().trim().toUpperCase();
        if (products.existsBySkuIgnoreCaseAndIdNot(sku, p.getId() == null ? -1L : p.getId())) {
            throw BusinessException.conflict("DUPLICATE_SKU", "Another product already uses SKU " + sku + ".");
        }
        p.setSku(sku);
        p.setName(r.name().trim());
        p.setDescription(r.description());
        p.setUnit(r.unit().trim());
        p.setUnitPrice(r.unitPrice());
        p.setCostPrice(r.costPrice());
        p.setTaxRate(r.taxRate());
        p.setReorderLevel(r.reorderLevel());
        if (r.active() != null) {
            p.setActive(r.active());
        }
        p.setCategory(r.categoryId() == null ? null : categories.findById(r.categoryId())
                .orElseThrow(() -> new NotFoundException("Category", r.categoryId())));
        p.setSupplier(r.supplierId() == null ? null : suppliers.find(r.supplierId()));
    }

    /** CSV of the filtered catalog, capped at 10,000 rows to keep memory bounded. */
    @Transactional(readOnly = true)
    public CsvWriter exportCsv(String search, Long categoryId, Long supplierId, Boolean active, boolean lowStock) {
        CsvWriter csv = new CsvWriter().row("SKU", "Name", "Category", "Supplier", "Unit", "Unit price",
                "Cost price", "Tax rate", "On hand", "Reorder level", "Active");
        Page<Product> chunk;
        int page = 0;
        int rows = 0;
        do {
            chunk = products.search(Pagination.likePattern(search), categoryId, supplierId, active, lowStock,
                    PageRequest.of(page++, 500, Sort.by("sku")));
            for (Product p : chunk) {
                csv.row(p.getSku(), p.getName(), p.getCategory() == null ? "" : p.getCategory().getName(),
                        p.getSupplier() == null ? "" : p.getSupplier().getName(), p.getUnit(), p.getUnitPrice(),
                        p.getCostPrice(), p.getTaxRate(), p.getQuantityOnHand(), p.getReorderLevel(), p.isActive());
                rows++;
            }
        } while (chunk.hasNext() && rows < 10_000);
        exportAuditor.record("products", rows);
        return csv;
    }

    public Product find(Long id) {
        return products.findById(id).orElseThrow(() -> new NotFoundException("Product", id));
    }
}
