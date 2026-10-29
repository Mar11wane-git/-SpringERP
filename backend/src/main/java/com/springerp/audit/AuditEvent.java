package com.springerp.audit;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

/** Immutable record of a security-relevant or business-relevant action. */
@Getter
@Setter
@Entity
@Table(name = "audit_events")
public class AuditEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, updatable = false)
    private Instant occurredAt;

    @Column(updatable = false)
    private Long actorId;

    @Column(updatable = false, length = 150)
    private String actorEmail;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false, length = 60)
    private AuditAction action;

    @Column(updatable = false, length = 60)
    private String entityType;

    @Column(updatable = false, length = 60)
    private String entityId;

    @Column(nullable = false, updatable = false, length = 500)
    private String summary;

    @Column(updatable = false, length = 45)
    private String ipAddress;

    @Column(updatable = false, length = 64)
    private String correlationId;
}
