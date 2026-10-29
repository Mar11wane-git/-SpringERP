package com.springerp.audit;

import java.time.Instant;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AuditRepository extends JpaRepository<AuditEvent, Long> {

    @Query("""
            select a from AuditEvent a
            where (:pattern is null or lower(a.summary) like :pattern or lower(a.actorEmail) like :pattern)
              and (:action is null or a.action = :action)
              and (:entityType is null or a.entityType = :entityType)
              and (:from is null or a.occurredAt >= :from)
              and (:to is null or a.occurredAt < :to)
            """)
    Page<AuditEvent> search(@Param("pattern") String pattern, @Param("action") AuditAction action,
            @Param("entityType") String entityType, @Param("from") Instant from, @Param("to") Instant to,
            Pageable pageable);

    List<AuditEvent> findTop10ByOrderByOccurredAtDesc();

    List<AuditEvent> findByEntityTypeAndEntityIdOrderByOccurredAtDesc(String entityType, String entityId);
}
