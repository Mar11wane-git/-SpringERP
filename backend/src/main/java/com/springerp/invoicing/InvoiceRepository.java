package com.springerp.invoicing;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collection;
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

public interface InvoiceRepository extends JpaRepository<Invoice, Long> {

    @EntityGraph(attributePaths = {"customer"})
    @Query("""
            select i from Invoice i
            where (:pattern is null or lower(i.invoiceNumber) like :pattern or lower(i.billToName) like :pattern)
              and (:status is null or i.status = :status)
              and (:customerId is null or i.customer.id = :customerId)
              and (:overdueBefore is null or (i.status in :openStatuses and i.dueDate < :overdueBefore))
              and (:from is null or i.issueDate >= :from)
              and (:to is null or i.issueDate <= :to)
            """)
    Page<Invoice> search(@Param("pattern") String pattern, @Param("status") Invoice.Status status,
            @Param("customerId") Long customerId, @Param("overdueBefore") LocalDate overdueBefore,
            @Param("openStatuses") Collection<Invoice.Status> openStatuses, @Param("from") LocalDate from,
            @Param("to") LocalDate to, Pageable pageable);

    @EntityGraph(attributePaths = {"customer", "salesOrder", "lines"})
    @Query("select i from Invoice i where i.id = :id")
    Optional<Invoice> findWithLines(@Param("id") Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from Invoice i where i.id = :id")
    Optional<Invoice> findByIdForUpdate(@Param("id") Long id);

    Optional<Invoice> findFirstBySalesOrderIdAndStatusNot(Long salesOrderId, Invoice.Status status);

    @Query("select count(i) from Invoice i where i.status in :open and i.dueDate < :today")
    long countOverdue(@Param("open") Collection<Invoice.Status> open, @Param("today") LocalDate today);

    @EntityGraph(attributePaths = {"customer"})
    @Query("select i from Invoice i where i.status in :open and i.dueDate < :today order by i.dueDate asc")
    List<Invoice> findOverdue(@Param("open") Collection<Invoice.Status> open, @Param("today") LocalDate today,
            Pageable pageable);

    @Query("select coalesce(sum(i.total - i.amountPaid), 0) from Invoice i where i.status in :open")
    BigDecimal outstandingTotal(@Param("open") Collection<Invoice.Status> open);

    @Query("""
            select coalesce(sum(i.total), 0) from Invoice i
            where i.status <> com.springerp.invoicing.Invoice.Status.CANCELLED
              and i.issueDate >= :from and i.issueDate <= :to
            """)
    BigDecimal invoicedBetween(@Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("""
            select year(i.issueDate), month(i.issueDate), count(i), coalesce(sum(i.total), 0)
            from Invoice i
            where i.status <> com.springerp.invoicing.Invoice.Status.CANCELLED
              and i.issueDate >= :from and i.issueDate <= :to
            group by year(i.issueDate), month(i.issueDate)
            """)
    List<Object[]> monthlyInvoiced(@Param("from") LocalDate from, @Param("to") LocalDate to);

    long countByStatusNot(Invoice.Status status);

    @EntityGraph(attributePaths = {"customer"})
    @Query("""
            select i from Invoice i
            where i.status <> com.springerp.invoicing.Invoice.Status.CANCELLED
              and i.issueDate >= :from and i.issueDate <= :to
            order by i.issueDate, i.invoiceNumber
            """)
    List<Invoice> findIssuedBetween(@Param("from") LocalDate from, @Param("to") LocalDate to);
}
