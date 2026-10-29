package com.springerp.hr;

import java.util.List;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface DepartmentRepository extends JpaRepository<Department, Long> {

    boolean existsByCodeIgnoreCaseAndIdNot(String code, Long id);

    boolean existsByNameIgnoreCaseAndIdNot(String name, Long id);

    @EntityGraph(attributePaths = {"parent", "manager"})
    @Query("select d from Department d order by d.name")
    List<Department> findAllWithRelations();

    @Query("select d.id, count(e) from Department d left join Employee e on e.department = d "
            + "and e.status <> com.springerp.hr.Employee.Status.TERMINATED group by d.id")
    List<Object[]> countActiveEmployeesByDepartment();
}
