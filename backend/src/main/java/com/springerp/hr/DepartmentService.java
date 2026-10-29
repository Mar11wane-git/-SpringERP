package com.springerp.hr;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import com.springerp.audit.AuditAction;
import com.springerp.audit.AuditService;
import com.springerp.common.error.BusinessException;
import com.springerp.common.error.NotFoundException;
import com.springerp.hr.HrDtos.DepartmentRequest;
import com.springerp.hr.HrDtos.DepartmentResponse;
import com.springerp.hr.HrDtos.Ref;
import lombok.RequiredArgsConstructor;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class DepartmentService {

    private final DepartmentRepository departments;
    private final EmployeeRepository employees;
    private final AuditService audit;

    /** Departments are few; the full list is returned for trees and pickers. */
    @Transactional(readOnly = true)
    public List<DepartmentResponse> list() {
        Map<Long, Long> counts = new HashMap<>();
        departments.countActiveEmployeesByDepartment().forEach(r -> counts.put((Long) r[0], (Long) r[1]));
        return departments.findAllWithRelations().stream()
                .map(d -> toResponse(d, counts.getOrDefault(d.getId(), 0L)))
                .toList();
    }

    @Transactional
    public DepartmentResponse create(DepartmentRequest request) {
        Department d = new Department();
        apply(d, request);
        departments.save(d);
        audit.record(AuditAction.DEPARTMENT_SAVED, "Department", d.getId(), "Created department " + d.getName());
        return toResponse(d, 0);
    }

    @Transactional
    public DepartmentResponse update(Long id, DepartmentRequest request) {
        Department d = departments.findById(id).orElseThrow(() -> new NotFoundException("Department", id));
        if (request.version() != null && request.version() != d.getVersion()) {
            throw new ObjectOptimisticLockingFailureException(Department.class, id);
        }
        apply(d, request);
        audit.record(AuditAction.DEPARTMENT_SAVED, "Department", id, "Updated department " + d.getName());
        return toResponse(d, 0);
    }

    private void apply(Department d, DepartmentRequest r) {
        Long id = d.getId() == null ? -1L : d.getId();
        if (departments.existsByCodeIgnoreCaseAndIdNot(r.code().trim(), id)) {
            throw BusinessException.conflict("DUPLICATE_CODE", "Another department already uses this code.");
        }
        if (departments.existsByNameIgnoreCaseAndIdNot(r.name().trim(), id)) {
            throw BusinessException.conflict("DUPLICATE_NAME", "Another department already uses this name.");
        }
        d.setCode(r.code().trim().toUpperCase());
        d.setName(r.name().trim());
        d.setDescription(r.description());
        d.setActive(r.active());
        d.setParent(resolveParent(d, r.parentId()));
        d.setManager(r.managerId() == null ? null
                : employees.findById(r.managerId()).orElseThrow(() -> new NotFoundException("Employee", r.managerId())));
    }

    /** Rejects parents that would create a cycle in the organization tree. */
    private Department resolveParent(Department d, Long parentId) {
        if (parentId == null) {
            return null;
        }
        Department parent = departments.findById(parentId)
                .orElseThrow(() -> new NotFoundException("Department", parentId));
        for (Department p = parent; p != null; p = p.getParent()) {
            if (d.getId() != null && p.getId().equals(d.getId())) {
                throw BusinessException.rule("DEPARTMENT_CYCLE", "A department cannot be nested inside itself.");
            }
        }
        return parent;
    }

    private static DepartmentResponse toResponse(Department d, long employeeCount) {
        return new DepartmentResponse(d.getId(), d.getCode(), d.getName(), d.getDescription(),
                d.getParent() == null ? null : new Ref(d.getParent().getId(), d.getParent().getName()),
                d.getManager() == null ? null : new Ref(d.getManager().getId(), d.getManager().fullName()),
                d.isActive(), employeeCount, d.getVersion());
    }
}
