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

/** Metadata of an employment document; the bytes live in the documents directory. */
@Getter
@Setter
@Entity
@Table(name = "employee_documents")
public class EmployeeDocument {

    public enum Category { CONTRACT, IDENTITY, CERTIFICATE, OTHER }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long employeeId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private Category category;

    @Column(nullable = false, length = 255)
    private String originalFilename;

    /** Server-generated random name; user input never reaches the file system path. */
    @Column(nullable = false, length = 64)
    private String storedFilename;

    @Column(nullable = false, length = 100)
    private String contentType;

    @Column(nullable = false)
    private long sizeBytes;

    @Column(length = 150)
    private String uploadedBy;

    @Column(nullable = false)
    private Instant uploadedAt;
}
