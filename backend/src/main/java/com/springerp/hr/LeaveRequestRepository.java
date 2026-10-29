package com.springerp.hr;

import java.time.LocalDate;
import java.util.Collection;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LeaveRequestRepository extends JpaRepository<LeaveRequest, Long> {

    @EntityGraph(attributePaths = {"employee", "employee.department", "decidedBy"})
    @Query("""
            select l from LeaveRequest l
            where (:employeeId is null or l.employee.id = :employeeId)
              and (:status is null or l.status = :status)
            """)
    Page<LeaveRequest> search(@Param("employeeId") Long employeeId, @Param("status") LeaveRequest.Status status,
            Pageable pageable);

    long countByStatus(LeaveRequest.Status status);

    /** Detects overlap with another active request of the same employee. */
    @Query("""
            select count(l) > 0 from LeaveRequest l
            where l.employee.id = :employeeId and l.status in :statuses
              and l.startDate <= :endDate and l.endDate >= :startDate
              and (:excludeId is null or l.id <> :excludeId)
            """)
    boolean overlaps(@Param("employeeId") Long employeeId, @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate, @Param("statuses") Collection<LeaveRequest.Status> statuses,
            @Param("excludeId") Long excludeId);
}
