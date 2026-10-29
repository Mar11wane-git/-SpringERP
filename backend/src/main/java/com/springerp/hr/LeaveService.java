package com.springerp.hr;

import java.time.Clock;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.EnumSet;
import java.util.Set;

import com.springerp.audit.AuditAction;
import com.springerp.audit.AuditService;
import com.springerp.common.api.PageResponse;
import com.springerp.common.api.Pagination;
import com.springerp.common.error.BusinessException;
import com.springerp.common.error.NotFoundException;
import com.springerp.hr.HrDtos.LeaveCreateRequest;
import com.springerp.hr.HrDtos.LeaveResponse;
import com.springerp.notification.Notification;
import com.springerp.notification.NotificationService;
import com.springerp.security.CurrentUser;
import com.springerp.security.Permission;
import com.springerp.user.User;
import com.springerp.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Leave workflow: PENDING -> APPROVED | REJECTED, and PENDING/APPROVED -> CANCELLED.
 *
 * Object-level authorization: users without EMPLOYEE_READ/LEAVE_APPROVE can only
 * see and act on requests of the employee record linked to their own account.
 */
@Service
@RequiredArgsConstructor
public class LeaveService {

    private static final Set<String> SORTABLE = Set.of("startDate", "createdAt", "status");
    private static final Set<LeaveRequest.Status> ACTIVE = EnumSet.of(LeaveRequest.Status.PENDING,
            LeaveRequest.Status.APPROVED);
    private static final int MAX_WORKING_DAYS = 120;

    private final LeaveRequestRepository leaves;
    private final EmployeeRepository employees;
    private final UserRepository users;
    private final NotificationService notifications;
    private final AuditService audit;
    private final Clock clock;

    @Transactional(readOnly = true)
    public PageResponse<LeaveResponse> search(Long employeeId, LeaveRequest.Status status, boolean mine,
            Pageable pageable) {
        Long scope = employeeId;
        if (mine || !canSeeAll()) {
            scope = ownEmployeeId();
        }
        Pageable page = Pagination.sanitize(pageable, SORTABLE, Sort.by(Sort.Direction.DESC, "createdAt"));
        return PageResponse.of(leaves.search(scope, status, page), LeaveResponse::from);
    }

    @Transactional
    public LeaveResponse create(LeaveCreateRequest request) {
        Long ownId = employees.findIdByUserId(CurrentUser.requireId()).orElse(null);
        Long employeeId = request.employeeId() != null ? request.employeeId() : ownId;
        if (employeeId == null) {
            throw BusinessException.rule("NO_EMPLOYEE_PROFILE",
                    "Your account is not linked to an employee record. Ask HR to link it.");
        }
        if (!employeeId.equals(ownId) && !CurrentUser.has(Permission.EMPLOYEE_WRITE)) {
            throw new AccessDeniedException("Cannot file leave for another employee");
        }
        Employee employee = employees.findById(employeeId)
                .orElseThrow(() -> new NotFoundException("Employee", employeeId));
        if (employee.getStatus() == Employee.Status.TERMINATED) {
            throw BusinessException.rule("EMPLOYEE_TERMINATED", "Terminated employees cannot request leave.");
        }
        if (request.endDate().isBefore(request.startDate())) {
            throw BusinessException.rule("INVALID_DATES", "The end date must be on or after the start date.");
        }
        int days = workingDays(request.startDate(), request.endDate());
        if (days == 0) {
            throw BusinessException.rule("NO_WORKING_DAYS", "The selected period contains no working days.");
        }
        if (days > MAX_WORKING_DAYS) {
            throw BusinessException.rule("PERIOD_TOO_LONG", "A single request cannot exceed 120 working days.");
        }
        if (leaves.overlaps(employeeId, request.startDate(), request.endDate(), ACTIVE, null)) {
            throw BusinessException.conflict("LEAVE_OVERLAP", "This period overlaps another pending or approved request.");
        }

        LeaveRequest leave = new LeaveRequest();
        leave.setEmployee(employee);
        leave.setType(request.type());
        leave.setStartDate(request.startDate());
        leave.setEndDate(request.endDate());
        leave.setWorkingDays(days);
        leave.setReason(request.reason());
        leave.setRequestedBy(currentUser());
        leaves.save(leave);

        audit.record(AuditAction.LEAVE_REQUESTED, "LeaveRequest", leave.getId(),
                employee.fullName() + " requested " + days + " day(s) of " + request.type() + " leave");
        notifications.notifyPermission(Permission.LEAVE_APPROVE, Notification.Type.LEAVE_REQUESTED,
                "Leave request to review",
                employee.fullName() + " requested " + days + " day(s) from " + request.startDate(), "/leave");
        return LeaveResponse.from(leave);
    }

    @Transactional
    public LeaveResponse approve(Long id, String note) {
        return decide(id, LeaveRequest.Status.APPROVED, note);
    }

    @Transactional
    public LeaveResponse reject(Long id, String note) {
        return decide(id, LeaveRequest.Status.REJECTED, note);
    }

    private LeaveResponse decide(Long id, LeaveRequest.Status decision, String note) {
        LeaveRequest leave = find(id);
        if (leave.getStatus() != LeaveRequest.Status.PENDING) {
            throw BusinessException.conflict("LEAVE_NOT_PENDING", "Only pending requests can be decided.");
        }
        Long ownId = employees.findIdByUserId(CurrentUser.requireId()).orElse(null);
        if (leave.getEmployee().getId().equals(ownId)) {
            throw BusinessException.rule("SELF_APPROVAL", "You cannot decide on your own leave request.");
        }
        if (decision == LeaveRequest.Status.APPROVED
                && leaves.overlaps(leave.getEmployee().getId(), leave.getStartDate(), leave.getEndDate(),
                        Set.of(LeaveRequest.Status.APPROVED), leave.getId())) {
            throw BusinessException.conflict("LEAVE_OVERLAP", "This period overlaps an already approved request.");
        }
        leave.setStatus(decision);
        leave.setDecidedBy(currentUser());
        leave.setDecidedAt(clock.instant());
        leave.setDecisionNote(note);

        boolean approved = decision == LeaveRequest.Status.APPROVED;
        audit.record(approved ? AuditAction.LEAVE_APPROVED : AuditAction.LEAVE_REJECTED, "LeaveRequest", id,
                (approved ? "Approved" : "Rejected") + " leave of " + leave.getEmployee().fullName());
        User requester = leave.getEmployee().getUser();
        if (requester != null) {
            notifications.notifyUser(requester.getId(), Notification.Type.LEAVE_DECIDED,
                    "Leave request " + (approved ? "approved" : "rejected"),
                    "Your leave from " + leave.getStartDate() + " to " + leave.getEndDate() + " was "
                            + (approved ? "approved." : "rejected."), "/leave");
        }
        return LeaveResponse.from(leave);
    }

    @Transactional
    public LeaveResponse cancel(Long id) {
        LeaveRequest leave = find(id);
        Long ownId = employees.findIdByUserId(CurrentUser.requireId()).orElse(null);
        boolean owner = leave.getEmployee().getId().equals(ownId);
        if (!owner && !CurrentUser.has(Permission.LEAVE_APPROVE)) {
            throw new AccessDeniedException("Not your leave request");
        }
        if (!ACTIVE.contains(leave.getStatus())) {
            throw BusinessException.conflict("LEAVE_NOT_CANCELLABLE", "Only pending or approved requests can be cancelled.");
        }
        if (leave.getStatus() == LeaveRequest.Status.APPROVED && !leave.getStartDate().isAfter(LocalDate.now(clock))
                && !CurrentUser.has(Permission.LEAVE_APPROVE)) {
            throw BusinessException.rule("LEAVE_STARTED", "Leave that has already started can only be cancelled by HR.");
        }
        leave.setStatus(LeaveRequest.Status.CANCELLED);
        audit.record(AuditAction.LEAVE_CANCELLED, "LeaveRequest", id,
                "Cancelled leave of " + leave.getEmployee().fullName());
        return LeaveResponse.from(leave);
    }

    /** Monday-to-Friday days in the inclusive range. Public holidays are not modelled. */
    static int workingDays(LocalDate start, LocalDate end) {
        int days = 0;
        for (LocalDate d = start; !d.isAfter(end); d = d.plusDays(1)) {
            if (d.getDayOfWeek() != DayOfWeek.SATURDAY && d.getDayOfWeek() != DayOfWeek.SUNDAY) {
                days++;
            }
        }
        return days;
    }

    private LeaveRequest find(Long id) {
        LeaveRequest leave = leaves.findById(id).orElseThrow(() -> new NotFoundException("Leave request", id));
        if (!canSeeAll()) {
            Long ownId = employees.findIdByUserId(CurrentUser.requireId()).orElse(null);
            if (!leave.getEmployee().getId().equals(ownId)) {
                // Same response as a missing record: do not reveal that the id exists.
                throw new NotFoundException("Leave request", id);
            }
        }
        return leave;
    }

    private static boolean canSeeAll() {
        return CurrentUser.has(Permission.LEAVE_APPROVE) || CurrentUser.has(Permission.EMPLOYEE_READ);
    }

    private Long ownEmployeeId() {
        // -1 matches nothing: a user without an employee record sees an empty list.
        return employees.findIdByUserId(CurrentUser.requireId()).orElse(-1L);
    }

    private User currentUser() {
        return users.getReferenceById(CurrentUser.requireId());
    }
}
