package com.springerp.hr;

import java.time.Instant;
import java.time.LocalDate;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class HrDtos {

    private HrDtos() {
    }

    public record Ref(Long id, String name) {
    }

    // ---- Departments ----

    public record DepartmentResponse(Long id, String code, String name, String description, Ref parent,
            Ref manager, boolean active, long employeeCount, long version) {
    }

    public record DepartmentRequest(
            @NotBlank @Size(max = 20) @Pattern(regexp = "[A-Za-z0-9_-]+", message = "Letters, digits, - and _ only")
            String code,
            @NotBlank @Size(max = 100) String name,
            @Size(max = 500) String description,
            Long parentId,
            Long managerId,
            boolean active,
            Long version) {
    }

    // ---- Employees ----

    public record EmployeeResponse(Long id, String employeeNumber, String firstName, String lastName, String fullName,
            String email, String phone, String jobTitle, Ref department, Ref manager, String userEmail,
            Employee.EmploymentType employmentType, Employee.Status status, LocalDate hireDate,
            LocalDate contractEndDate, LocalDate terminationDate, Instant createdAt, long version) {

        public static EmployeeResponse from(Employee e) {
            return new EmployeeResponse(e.getId(), e.getEmployeeNumber(), e.getFirstName(), e.getLastName(),
                    e.fullName(), e.getEmail(), e.getPhone(), e.getJobTitle(),
                    e.getDepartment() == null ? null : new Ref(e.getDepartment().getId(), e.getDepartment().getName()),
                    e.getManager() == null ? null : new Ref(e.getManager().getId(), e.getManager().fullName()),
                    e.getUser() == null ? null : e.getUser().getEmail(),
                    e.getEmploymentType(), e.getStatus(), e.getHireDate(), e.getContractEndDate(),
                    e.getTerminationDate(), e.getCreatedAt(), e.getVersion());
        }
    }

    public record EmployeeRequest(
            @NotBlank @Size(max = 80) String firstName,
            @NotBlank @Size(max = 80) String lastName,
            @NotBlank @Email @Size(max = 150) String email,
            @Size(max = 40) String phone,
            @NotBlank @Size(max = 100) String jobTitle,
            Long departmentId,
            Long managerId,
            @Email @Size(max = 150) String userEmail,
            @NotNull Employee.EmploymentType employmentType,
            @NotNull LocalDate hireDate,
            LocalDate contractEndDate,
            Long version) {
    }

    public record StatusChangeRequest(@NotNull Employee.Status status, LocalDate effectiveDate,
            @Size(max = 255) String note) {
    }

    public record StatusChangeResponse(Long id, Employee.Status fromStatus, Employee.Status toStatus,
            Instant changedAt, String changedBy, String note) {

        static StatusChangeResponse from(EmployeeStatusChange c) {
            return new StatusChangeResponse(c.getId(), c.getFromStatus(), c.getToStatus(), c.getChangedAt(),
                    c.getChangedBy(), c.getNote());
        }
    }

    public record DocumentResponse(Long id, EmployeeDocument.Category category, String originalFilename,
            String contentType, long sizeBytes, String uploadedBy, Instant uploadedAt) {

        static DocumentResponse from(EmployeeDocument d) {
            return new DocumentResponse(d.getId(), d.getCategory(), d.getOriginalFilename(), d.getContentType(),
                    d.getSizeBytes(), d.getUploadedBy(), d.getUploadedAt());
        }
    }

    // ---- Leave ----

    public record LeaveResponse(Long id, Ref employee, String departmentName, LeaveRequest.Type type,
            LocalDate startDate, LocalDate endDate, int workingDays, String reason, LeaveRequest.Status status,
            String decidedBy, Instant decidedAt, String decisionNote, Instant createdAt) {

        static LeaveResponse from(LeaveRequest l) {
            Employee e = l.getEmployee();
            return new LeaveResponse(l.getId(), new Ref(e.getId(), e.fullName()),
                    e.getDepartment() == null ? null : e.getDepartment().getName(), l.getType(), l.getStartDate(),
                    l.getEndDate(), l.getWorkingDays(), l.getReason(), l.getStatus(),
                    l.getDecidedBy() == null ? null : l.getDecidedBy().getFullName(), l.getDecidedAt(),
                    l.getDecisionNote(), l.getCreatedAt());
        }
    }

    public record LeaveCreateRequest(
            Long employeeId,
            @NotNull LeaveRequest.Type type,
            @NotNull LocalDate startDate,
            @NotNull LocalDate endDate,
            @Size(max = 500) String reason) {
    }

    public record LeaveDecisionRequest(@Size(max = 500) String note) {
    }
}
