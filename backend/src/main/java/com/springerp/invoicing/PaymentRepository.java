package com.springerp.invoicing;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PaymentRepository extends JpaRepository<Payment, Long> {

    List<Payment> findByInvoiceIdOrderByPaymentDateAscIdAsc(Long invoiceId);

    @Query("select coalesce(sum(p.amount), 0) from Payment p where p.paymentDate >= :from and p.paymentDate <= :to")
    BigDecimal collectedBetween(@Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("""
            select year(p.paymentDate), month(p.paymentDate), coalesce(sum(p.amount), 0)
            from Payment p where p.paymentDate >= :from and p.paymentDate <= :to
            group by year(p.paymentDate), month(p.paymentDate)
            """)
    List<Object[]> monthlyCollected(@Param("from") LocalDate from, @Param("to") LocalDate to);
}
