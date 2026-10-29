package com.springerp.hr;

import java.time.Clock;
import java.util.List;
import java.util.Set;

import com.springerp.audit.AuditAction;
import com.springerp.audit.AuditService;
import com.springerp.common.api.PageResponse;
import com.springerp.common.api.Pagination;
import com.springerp.common.error.BusinessException;
import com.springerp.common.error.NotFoundException;
import com.springerp.hr.HrDtos.EmployeeRequest;
import com.springerp.hr.HrDtos.EmployeeResponse;
import com.springerp.hr.HrDtos.StatusChangeRequest;
import com.springerp.hr.HrDtos.StatusChangeResponse;
import com.springerp.numbering.DocumentNumberService;
import com.springerp.security.CurrentUser;
import com.springerp.user.User;
import com.springerp.user.UserRepository;
import com.springerp.user.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class EmployeeService {

    private static final Set<String> SORTABLE =
            Set.of("employeeNumber", "lastName", "firstName", "jobTitle", "hireDate", "status", "createdAt");

    private final EmployeeRepository employees;
    private final DepartmentRepository departments;
    private final EmployeeStatusChangeRepository statusHistory;
    private final UserRepository users;
    private final DocumentNumberService numbers;
    private final AuditService audit;
    private final Clock clock;

    @Transactional(readOnly = true)
    public PageResponse<EmployeeResponse> search(String search, Long departmentId, Employee.Status status,
            Pageable pageable) {
        Pageable page = Pagination.sanitize(pageable, SORTABLE, Sort.by("lastName", "firstName"));
        return PageResponse.of(employees.search(Pagination.likePattern(search), departmentId, status, page),
                EmployeeResponse::from);
    }

    @Transactional(readOnly = true)
    public EmployeeResponse get(Long id) {
        return EmployeeResponse.from(find(id));
    }

    @Transactional
    public EmployeeResponse create(EmployeeRequest request) {
        Employee e = new Employee();
        e.setEmployeeNumber(numbers.next("EMP"));
        apply(e, request);
        employees.save(e);
        recordStatus(e, null, Employee.Status.ACTIVE, "Hired");
        audit.record(AuditAction.EMPLOYEE_CREATED, "Employee", e.getId(),
                "Created employee " + e.getEmployeeNumber() + " " + e.fullName());
        return EmployeeResponse.from(e);
    }

    @Transactional
    public EmployeeResponse update(Long id, EmployeeRequest request) {
        Employee e = find(id);
        if (request.version() != null && request.version() != e.getVersion()) {
            throw new ObjectOptimisticLockingFailureException(Employee.class, id);
        }
        apply(e, request);
        audit.record(AuditAction.EMPLOYEE_UPDATED, "Employee", id, "Updated employee " + e.fullName());
        return EmployeeResponse.from(e);
    }

    @Transactional
    public EmployeeResponse changeStatus(Long id, StatusChangeRequest request) {
        Employee e = find(id);
        Employee.Status from = e.getStatus();
        if (from == request.status()) {
            throw BusinessException.rule("STATUS_UNCHANGED", "The employee already has this status.");
        }
        if (from == Employee.Status.TERMINATED) {
            throw BusinessException.rule("EMPLOYEE_TERMINATED", "A terminated employee cannot change status.");
        }
        e.setStatus(request.status());
        if (request.status() == Employee.Status.TERMINATED) {
            e.setTerminationDate(request.effectiveDate() != null ? request.effectiveDate()
                    : java.time.LocalDate.now(clock));
        }
        recordStatus(e, from, request.status(), request.note());
        audit.record(AuditAction.EMPLOYEE_STATUS_CHANGED, "Employee", id,
                e.fullName() + ": " + from + " -> " + request.status());
        return EmployeeResponse.from(e);
    }

    @Transactional(readOnly = true)
    public List<StatusChangeResponse> statusHistory(Long id) {
        find(id);
        return statusHistory.findByEmployeeIdOrderByChangedAtDesc(id).stream()
                .map(StatusChangeResponse::from).toList();
    }

    private void apply(Employee e, EmployeeRequest r) {
        Long id = e.getId() == null ? -1L : e.getId();
        String email = UserService.normalizeEmail(r.email());
        if (employees.existsByEmailIgnoreCaseAndIdNot(email, id)) {
            throw BusinessException.conflict("DUPLICATE_EMAIL", "Another employee already uses this email.");
        }
        if (r.contractEndDate() != null && r.contractEndDate().isBefore(r.hireDate())) {
            throw BusinessException.rule("INVALID_CONTRACT_END", "Contract end date must be after the hire date.");
        }
        e.setFirstName(r.firstName().trim());
        e.setLastName(r.lastName().trim());
        e.setEmail(email);
        e.setPhone(r.phone());
        e.setJobTitle(r.jobTitle().trim());
        e.setEmploymentType(r.employmentType());
        e.setHireDate(r.hireDate());
        e.setContractEndDate(r.contractEndDate());
        e.setDepartment(r.departmentId() == null ? null : departments.findById(r.departmentId())
                .orElseThrow(() -> new NotFoundException("Department", r.departmentId())));
        if (r.managerId() != null && r.managerId().equals(e.getId())) {
            throw BusinessException.rule("SELF_MANAGER", "An employee cannot be their own manager.");
        }
        e.setManager(r.managerId() == null ? null : find(r.managerId()));
        e.setUser(resolveUser(r.userEmail(), id));
    }

    private User resolveUser(String userEmail, Long employeeId) {
        if (userEmail == null || userEmail.isBlank()) {
            return null;
        }
        User user = users.findByEmail(UserService.normalizeEmail(userEmail))
                .orElseThrow(() -> BusinessException.rule("USER_NOT_FOUND", "No user account with this email."));
        if (employees.existsByUserIdAndIdNot(user.getId(), employeeId)) {
            throw BusinessException.conflict("USER_ALREADY_LINKED",
                    "This user account is already linked to another employee.");
        }
        return user;
    }

    private void recordStatus(Employee e, Employee.Status from, Employee.Status to, String note) {
        EmployeeStatusChange change = new EmployeeStatusChange();
        change.setEmployeeId(e.getId());
        change.setFromStatus(from);
        change.setToStatus(to);
        change.setChangedAt(clock.instant());
        change.setChangedBy(CurrentUser.label());
        change.setNote(note);
        statusHistory.save(change);
    }

    Employee find(Long id) {
        return employees.findById(id).orElseThrow(() -> new NotFoundException("Employee", id));
    }
}
