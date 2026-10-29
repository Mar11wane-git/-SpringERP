package com.springerp.hr;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface EmployeeStatusChangeRepository extends JpaRepository<EmployeeStatusChange, Long> {

    List<EmployeeStatusChange> findByEmployeeIdOrderByChangedAtDesc(Long employeeId);
}
