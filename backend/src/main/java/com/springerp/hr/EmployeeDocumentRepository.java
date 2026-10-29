package com.springerp.hr;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface EmployeeDocumentRepository extends JpaRepository<EmployeeDocument, Long> {

    List<EmployeeDocument> findByEmployeeIdOrderByUploadedAtDesc(Long employeeId);

    /** Scoped by employee so a document id cannot be fetched through another employee's URL. */
    Optional<EmployeeDocument> findByIdAndEmployeeId(Long id, Long employeeId);
}
