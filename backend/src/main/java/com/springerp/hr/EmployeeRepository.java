package com.springerp.hr;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EmployeeRepository extends JpaRepository<Employee, Long> {

    boolean existsByEmailIgnoreCaseAndIdNot(String email, Long id);

    @Query("select e.id from Employee e where e.user.id = :userId")
    Optional<Long> findIdByUserId(@Param("userId") Long userId);

    Optional<Employee> findByUserId(Long userId);

    boolean existsByUserIdAndIdNot(Long userId, Long id);

    long countByStatusNot(Employee.Status status);

    @EntityGraph(attributePaths = {"department", "manager", "user"})
    @Query("""
            select e from Employee e
            where (:pattern is null or lower(e.firstName) like :pattern or lower(e.lastName) like :pattern
                   or lower(e.email) like :pattern or lower(e.employeeNumber) like :pattern
                   or lower(e.jobTitle) like :pattern)
              and (:departmentId is null or e.department.id = :departmentId)
              and (:status is null or e.status = :status)
            """)
    Page<Employee> search(@Param("pattern") String pattern, @Param("departmentId") Long departmentId,
            @Param("status") Employee.Status status, Pageable pageable);

    /** Headcount per department name (null = unassigned), excluding terminated employees. */
    @Query("select d.name, count(e) from Employee e left join e.department d "
            + "where e.status <> com.springerp.hr.Employee.Status.TERMINATED group by d.name")
    List<Object[]> headcountByDepartment();
}
