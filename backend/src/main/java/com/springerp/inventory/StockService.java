package com.springerp.inventory;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Set;

import com.springerp.audit.AuditAction;
import com.springerp.audit.AuditService;
import com.springerp.common.api.PageResponse;
import com.springerp.common.api.Pagination;
import com.springerp.common.error.BusinessException;
import com.springerp.common.error.NotFoundException;
import com.springerp.inventory.InventoryDtos.StockMovementRequest;
import com.springerp.inventory.InventoryDtos.StockMovementResponse;
import com.springerp.notification.Notification;
import com.springerp.notification.NotificationService;
import com.springerp.partner.Supplier;
import com.springerp.partner.SupplierService;
import com.springerp.security.CurrentUser;
import com.springerp.security.Permission;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * The only component allowed to change on-hand quantities. Every change:
 * locks the product row, refuses to go below zero, writes a ledger entry with the
 * resulting quantity, and raises a low-stock notification when the threshold is crossed.
 */
@Service
@RequiredArgsConstructor
public class StockService {

    private final ProductRepository products;
    private final StockMovementRepository movements;
    private final SupplierService suppliers;
    private final NotificationService notifications;
    private final AuditService audit;
    private final Clock clock;

    /** Manual movement from the UI (receipt, issue or count adjustment). */
    @Transactional
    public StockMovementResponse record(Long productId, StockMovementRequest r) {
        int delta = switch (r.type()) {
            case RECEIPT -> {
                requirePositive(r.quantity());
                require(Permission.INVENTORY_WRITE);
                yield r.quantity();
            }
            case ISSUE -> {
                requirePositive(r.quantity());
                require(Permission.STOCK_ADJUST);
                yield -r.quantity();
            }
            case ADJUSTMENT -> {
                if (r.quantity() == 0) {
                    throw BusinessException.rule("ZERO_QUANTITY", "An adjustment must change the quantity.");
                }
                require(Permission.STOCK_ADJUST);
                yield r.quantity();
            }
            case SALE, SALE_REVERSAL -> throw BusinessException.rule("RESERVED_MOVEMENT_TYPE",
                    "Sales movements are created by sales orders only.");
        };
        Supplier supplier = r.supplierId() == null ? null : suppliers.find(r.supplierId());
        BigDecimal unitCost = r.type() == StockMovement.Type.RECEIPT ? r.unitCost() : null;
        StockMovement m = apply(productId, r.type(), delta, unitCost, supplier, null, r.reference(), r.note());
        audit.record(AuditAction.STOCK_MOVEMENT, "Product", productId,
                r.type() + " " + (delta > 0 ? "+" : "") + delta + " on " + m.getProduct().getSku()
                        + " (now " + m.getQuantityAfter() + ")");
        return StockMovementResponse.from(m);
    }

    /** Used by other modules (sales orders) inside their own transaction. */
    @Transactional(propagation = Propagation.MANDATORY)
    public StockMovement apply(Long productId, StockMovement.Type type, int delta, BigDecimal unitCost,
            Supplier supplier, Long salesOrderId, String reference, String note) {
        Product product = products.findByIdForUpdate(productId)
                .orElseThrow(() -> new NotFoundException("Product", productId));
        int before = product.getQuantityOnHand();
        int after = before + delta;
        if (after < 0) {
            throw BusinessException.rule("INSUFFICIENT_STOCK", "Insufficient stock for " + product.getSku() + ": "
                    + before + " " + product.getUnit() + " available, " + (-delta) + " requested.");
        }
        product.setQuantityOnHand(after);

        StockMovement m = new StockMovement();
        m.setProduct(product);
        m.setType(type);
        m.setQuantity(delta);
        m.setQuantityAfter(after);
        m.setUnitCost(unitCost);
        m.setSupplier(supplier);
        m.setSalesOrderId(salesOrderId);
        m.setReference(reference);
        m.setNote(note);
        m.setCreatedAt(clock.instant());
        m.setCreatedBy(CurrentUser.label());
        movements.save(m);

        if (before > product.getReorderLevel() && after <= product.getReorderLevel() && product.isActive()) {
            notifications.notifyPermission(Permission.INVENTORY_WRITE, Notification.Type.LOW_STOCK,
                    "Low stock: " + product.getSku(),
                    product.getName() + " is down to " + after + " " + product.getUnit()
                            + " (reorder level " + product.getReorderLevel() + ").",
                    "/inventory/products/" + product.getId());
        }
        return m;
    }

    @Transactional(readOnly = true)
    public PageResponse<StockMovementResponse> search(Long productId, StockMovement.Type type, LocalDate from,
            LocalDate to, Pageable pageable) {
        Pageable page = Pagination.sanitize(pageable, Set.of("createdAt", "quantity"),
                Sort.by(Sort.Direction.DESC, "createdAt"));
        Instant fromInstant = from == null ? null : from.atStartOfDay().toInstant(ZoneOffset.UTC);
        Instant toInstant = to == null ? null : to.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC);
        return PageResponse.of(movements.search(productId, type, fromInstant, toInstant, page),
                StockMovementResponse::from);
    }

    private static void requirePositive(int quantity) {
        if (quantity <= 0) {
            throw BusinessException.rule("INVALID_QUANTITY", "Quantity must be greater than zero.");
        }
    }

    private static void require(Permission permission) {
        if (!CurrentUser.has(permission)) {
            throw new AccessDeniedException("Missing " + permission);
        }
    }
}
