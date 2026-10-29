package com.springerp.inventory;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProductRepository extends JpaRepository<Product, Long> {

    boolean existsBySkuIgnoreCaseAndIdNot(String sku, Long id);

    boolean existsByCategoryId(Long categoryId);

    /** Row lock (SELECT ... FOR UPDATE) serializing concurrent stock changes of one product. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Product p where p.id = :id")
    Optional<Product> findByIdForUpdate(@Param("id") Long id);

    @EntityGraph(attributePaths = {"category", "supplier"})
    @Query("""
            select p from Product p
            where (:pattern is null or lower(p.name) like :pattern or lower(p.sku) like :pattern)
              and (:categoryId is null or p.category.id = :categoryId)
              and (:supplierId is null or p.supplier.id = :supplierId)
              and (:active is null or p.active = :active)
              and (:lowStock = false or p.quantityOnHand <= p.reorderLevel)
            """)
    Page<Product> search(@Param("pattern") String pattern, @Param("categoryId") Long categoryId,
            @Param("supplierId") Long supplierId,
            @Param("active") Boolean active, @Param("lowStock") boolean lowStock, Pageable pageable);

    long countByActiveTrue();

    @Query("select count(p) from Product p where p.active = true and p.quantityOnHand <= p.reorderLevel")
    long countLowStock();

    @Query("select p from Product p where p.active = true and p.quantityOnHand <= p.reorderLevel "
            + "order by p.quantityOnHand asc, p.name asc")
    List<Product> findLowStock(Pageable pageable);

    @Query("select coalesce(sum(p.costPrice * p.quantityOnHand), 0) from Product p where p.active = true")
    BigDecimal inventoryValueAtCost();

    @EntityGraph(attributePaths = {"category"})
    @Query("select p from Product p where p.active = true order by p.name")
    List<Product> findAllActiveWithCategory();
}
