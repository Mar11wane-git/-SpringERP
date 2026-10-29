package com.springerp.inventory;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StockMovementRepository extends JpaRepository<StockMovement, Long> {

    @EntityGraph(attributePaths = {"product", "supplier"})
    @Query("""
            select m from StockMovement m
            where (:productId is null or m.product.id = :productId)
              and (:type is null or m.type = :type)
              and (:from is null or m.createdAt >= :from)
              and (:to is null or m.createdAt < :to)
            """)
    Page<StockMovement> search(@Param("productId") Long productId, @Param("type") StockMovement.Type type,
            @Param("from") Instant from, @Param("to") Instant to, Pageable pageable);

    /** Purchase spend: value of goods received from suppliers in the period. */
    @Query("""
            select coalesce(sum(m.unitCost * m.quantity), 0) from StockMovement m
            where m.type = com.springerp.inventory.StockMovement.Type.RECEIPT and m.unitCost is not null
              and m.createdAt >= :from and m.createdAt < :to
            """)
    BigDecimal purchaseValueBetween(@Param("from") Instant from, @Param("to") Instant to);

    @Query("""
            select m.createdAt, m.unitCost * m.quantity from StockMovement m
            where m.type = com.springerp.inventory.StockMovement.Type.RECEIPT and m.unitCost is not null
              and m.createdAt >= :from and m.createdAt < :to
            """)
    List<Object[]> purchasesBetween(@Param("from") Instant from, @Param("to") Instant to);
}
