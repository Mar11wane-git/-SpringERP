package com.springerp.hr;

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

/** Append-only employment status history. */
@Getter
@Setter
@Entity
@Table(name = "employee_status_history")
public class EmployeeStatusChange {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long employeeId;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private Employee.Status fromStatus;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Employee.Status toStatus;

    @Column(nullable = false)
    private Instant changedAt;

    @Column(length = 150)
    private String changedBy;

    @Column(length = 255)
    private String note;
}
