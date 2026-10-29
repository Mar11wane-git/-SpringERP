package com.springerp.hr;

import java.util.List;

import com.springerp.common.api.PageResponse;
import com.springerp.hr.EmployeeDocumentService.StoredDocument;
import com.springerp.hr.HrDtos.DepartmentRequest;
import com.springerp.hr.HrDtos.DepartmentResponse;
import com.springerp.hr.HrDtos.DocumentResponse;
import com.springerp.hr.HrDtos.EmployeeRequest;
import com.springerp.hr.HrDtos.EmployeeResponse;
import com.springerp.hr.HrDtos.LeaveCreateRequest;
import com.springerp.hr.HrDtos.LeaveDecisionRequest;
import com.springerp.hr.HrDtos.LeaveResponse;
import com.springerp.hr.HrDtos.StatusChangeRequest;
import com.springerp.hr.HrDtos.StatusChangeResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/** HTTP endpoints of the HR module; each class only maps requests to services. */
final class HrControllers {

    private HrControllers() {
    }

    @Tag(name = "Departments")
    @RestController
    @RequestMapping("/api/departments")
    @RequiredArgsConstructor
    static class DepartmentController {

        private final DepartmentService service;

        /** Readable by all signed-in users: needed for pickers and the org overview. */
        @GetMapping
        public List<DepartmentResponse> list() {
            return service.list();
        }

        @PostMapping
        @ResponseStatus(HttpStatus.CREATED)
        @PreAuthorize("hasAuthority('EMPLOYEE_WRITE')")
        public DepartmentResponse create(@Valid @RequestBody DepartmentRequest request) {
            return service.create(request);
        }

        @PutMapping("/{id}")
        @PreAuthorize("hasAuthority('EMPLOYEE_WRITE')")
        public DepartmentResponse update(@PathVariable Long id, @Valid @RequestBody DepartmentRequest request) {
            return service.update(id, request);
        }
    }

    @Tag(name = "Employees")
    @RestController
    @RequestMapping("/api/employees")
    @RequiredArgsConstructor
    static class EmployeeController {

        private final EmployeeService service;
        private final EmployeeDocumentService documents;

        @GetMapping
        @PreAuthorize("hasAuthority('EMPLOYEE_READ')")
        public PageResponse<EmployeeResponse> list(@RequestParam(required = false) String search,
                @RequestParam(required = false) Long departmentId,
                @RequestParam(required = false) Employee.Status status, Pageable pageable) {
            return service.search(search, departmentId, status, pageable);
        }

        @GetMapping("/{id}")
        @PreAuthorize("hasAuthority('EMPLOYEE_READ')")
        public EmployeeResponse get(@PathVariable Long id) {
            return service.get(id);
        }

        @PostMapping
        @ResponseStatus(HttpStatus.CREATED)
        @PreAuthorize("hasAuthority('EMPLOYEE_WRITE')")
        public EmployeeResponse create(@Valid @RequestBody EmployeeRequest request) {
            return service.create(request);
        }

        @PutMapping("/{id}")
        @PreAuthorize("hasAuthority('EMPLOYEE_WRITE')")
        public EmployeeResponse update(@PathVariable Long id, @Valid @RequestBody EmployeeRequest request) {
            return service.update(id, request);
        }

        @PostMapping("/{id}/status")
        @PreAuthorize("hasAuthority('EMPLOYEE_WRITE')")
        public EmployeeResponse changeStatus(@PathVariable Long id, @Valid @RequestBody StatusChangeRequest request) {
            return service.changeStatus(id, request);
        }

        @GetMapping("/{id}/status-history")
        @PreAuthorize("hasAuthority('EMPLOYEE_READ')")
        public List<StatusChangeResponse> statusHistory(@PathVariable Long id) {
            return service.statusHistory(id);
        }

        // Documents are personal data: restricted to HR-level permission, not plain read access.

        @GetMapping("/{id}/documents")
        @PreAuthorize("hasAuthority('EMPLOYEE_WRITE')")
        public List<DocumentResponse> listDocuments(@PathVariable Long id) {
            return documents.list(id);
        }

        @PostMapping(path = "/{id}/documents", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
        @ResponseStatus(HttpStatus.CREATED)
        @PreAuthorize("hasAuthority('EMPLOYEE_WRITE')")
        public DocumentResponse upload(@PathVariable Long id, @RequestParam EmployeeDocument.Category category,
                @RequestPart("file") MultipartFile file) {
            return documents.upload(id, category, file);
        }

        @GetMapping("/{id}/documents/{documentId}")
        @PreAuthorize("hasAuthority('EMPLOYEE_WRITE')")
        public ResponseEntity<Resource> download(@PathVariable Long id, @PathVariable Long documentId) {
            StoredDocument doc = documents.load(id, documentId);
            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(doc.contentType()))
                    .header(HttpHeaders.CONTENT_DISPOSITION,
                            ContentDisposition.attachment().filename(doc.filename(), java.nio.charset.StandardCharsets.UTF_8)
                                    .build().toString())
                    .body(doc.resource());
        }

        @DeleteMapping("/{id}/documents/{documentId}")
        @ResponseStatus(HttpStatus.NO_CONTENT)
        @PreAuthorize("hasAuthority('EMPLOYEE_WRITE')")
        public void deleteDocument(@PathVariable Long id, @PathVariable Long documentId) {
            documents.delete(id, documentId);
        }
    }

    @Tag(name = "Leave requests")
    @RestController
    @RequestMapping("/api/leave-requests")
    @RequiredArgsConstructor
    static class LeaveController {

        private final LeaveService service;

        /** Any signed-in user; the service restricts results to their own records unless privileged. */
        @GetMapping
        public PageResponse<LeaveResponse> list(@RequestParam(required = false) Long employeeId,
                @RequestParam(required = false) LeaveRequest.Status status,
                @RequestParam(defaultValue = "false") boolean mine, Pageable pageable) {
            return service.search(employeeId, status, mine, pageable);
        }

        @PostMapping
        @ResponseStatus(HttpStatus.CREATED)
        public LeaveResponse create(@Valid @RequestBody LeaveCreateRequest request) {
            return service.create(request);
        }

        @PostMapping("/{id}/approve")
        @PreAuthorize("hasAuthority('LEAVE_APPROVE')")
        public LeaveResponse approve(@PathVariable Long id, @Valid @RequestBody(required = false)
                LeaveDecisionRequest request) {
            return service.approve(id, request == null ? null : request.note());
        }

        @PostMapping("/{id}/reject")
        @PreAuthorize("hasAuthority('LEAVE_APPROVE')")
        public LeaveResponse reject(@PathVariable Long id, @Valid @RequestBody(required = false)
                LeaveDecisionRequest request) {
            return service.reject(id, request == null ? null : request.note());
        }

        @PostMapping("/{id}/cancel")
        public LeaveResponse cancel(@PathVariable Long id) {
            return service.cancel(id);
        }
    }
}
