package com.springerp.sales;

import java.math.BigDecimal;
import java.time.LocalDate;
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

public interface SalesOrderRepository extends JpaRepository<SalesOrder, Long> {

    @EntityGraph(attributePaths = {"customer"})
    @Query("""
            select o from SalesOrder o
            where (:pattern is null or lower(o.orderNumber) like :pattern or lower(o.customer.name) like :pattern)
              and (:status is null or o.status = :status)
              and (:customerId is null or o.customer.id = :customerId)
              and (:from is null or o.orderDate >= :from)
              and (:to is null or o.orderDate <= :to)
            """)
    Page<SalesOrder> search(@Param("pattern") String pattern, @Param("status") SalesOrder.Status status,
            @Param("customerId") Long customerId, @Param("from") LocalDate from, @Param("to") LocalDate to,
            Pageable pageable);

    @EntityGraph(attributePaths = {"customer", "lines", "lines.product"})
    @Query("select o from SalesOrder o where o.id = :id")
    Optional<SalesOrder> findWithLines(@Param("id") Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from SalesOrder o where o.id = :id")
    Optional<SalesOrder> findByIdForUpdate(@Param("id") Long id);

    long countByStatus(SalesOrder.Status status);

    @Query("select o.status, count(o) from SalesOrder o group by o.status")
    List<Object[]> countByStatusGrouped();

    @Query("""
            select year(o.orderDate), month(o.orderDate), count(o), coalesce(sum(o.total), 0)
            from SalesOrder o
            where o.status in (com.springerp.sales.SalesOrder.Status.CONFIRMED, com.springerp.sales.SalesOrder.Status.COMPLETED)
              and o.orderDate >= :from and o.orderDate <= :to
            group by year(o.orderDate), month(o.orderDate)
            """)
    List<Object[]> monthlyBookings(@Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("""
            select coalesce(sum(o.total), 0) from SalesOrder o
            where o.status in (com.springerp.sales.SalesOrder.Status.CONFIRMED, com.springerp.sales.SalesOrder.Status.COMPLETED)
              and o.orderDate >= :from and o.orderDate <= :to
            """)
    BigDecimal bookedBetween(@Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("""
            select l.product.id, l.product.sku, l.product.name, sum(l.quantity), sum(l.lineSubtotal)
            from SalesOrderLine l
            where l.order.status in (com.springerp.sales.SalesOrder.Status.CONFIRMED, com.springerp.sales.SalesOrder.Status.COMPLETED)
              and l.order.orderDate >= :from and l.order.orderDate <= :to
            group by l.product.id, l.product.sku, l.product.name
            order by sum(l.lineSubtotal) desc
            """)
    List<Object[]> topProducts(@Param("from") LocalDate from, @Param("to") LocalDate to, Pageable pageable);
}
