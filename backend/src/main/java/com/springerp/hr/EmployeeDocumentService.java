package com.springerp.hr;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.Clock;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

import com.springerp.audit.AuditAction;
import com.springerp.audit.AuditService;
import com.springerp.common.error.BusinessException;
import com.springerp.common.error.NotFoundException;
import com.springerp.config.AppProperties;
import com.springerp.hr.HrDtos.DocumentResponse;
import com.springerp.security.CurrentUser;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * Stores employment documents on disk. Defences:
 * - type is decided from the file's magic bytes, not the client's Content-Type or extension;
 * - size is capped (multipart limit plus an explicit check);
 * - stored names are random UUIDs, and the resolved path is verified to stay inside the root.
 */
@Service
public class EmployeeDocumentService {

    static final long MAX_BYTES = 5L * 1024 * 1024;

    private enum AllowedType {
        PDF("application/pdf", ".pdf", new byte[] {0x25, 0x50, 0x44, 0x46}),
        PNG("image/png", ".png", new byte[] {(byte) 0x89, 0x50, 0x4E, 0x47}),
        JPEG("image/jpeg", ".jpg", new byte[] {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF});

        final String contentType;
        final String extension;
        final byte[] magic;

        AllowedType(String contentType, String extension, byte[] magic) {
            this.contentType = contentType;
            this.extension = extension;
            this.magic = magic;
        }
    }

    private final EmployeeDocumentRepository documents;
    private final EmployeeService employees;
    private final AuditService audit;
    private final Clock clock;
    private final Path root;

    public EmployeeDocumentService(EmployeeDocumentRepository documents, EmployeeService employees,
            AuditService audit, Clock clock, AppProperties properties) {
        this.documents = documents;
        this.employees = employees;
        this.audit = audit;
        this.clock = clock;
        this.root = Paths.get(properties.storage().documentsDir()).toAbsolutePath().normalize();
    }

    @Transactional(readOnly = true)
    public List<DocumentResponse> list(Long employeeId) {
        employees.find(employeeId);
        return documents.findByEmployeeIdOrderByUploadedAtDesc(employeeId).stream()
                .map(DocumentResponse::from).toList();
    }

    @Transactional
    public DocumentResponse upload(Long employeeId, EmployeeDocument.Category category, MultipartFile file) {
        Employee employee = employees.find(employeeId);
        if (file == null || file.isEmpty()) {
            throw BusinessException.rule("EMPTY_FILE", "Choose a file to upload.");
        }
        if (file.getSize() > MAX_BYTES) {
            throw BusinessException.rule("FILE_TOO_LARGE", "The file exceeds the 5 MB limit.");
        }
        AllowedType type = detectType(file);
        String storedName = UUID.randomUUID() + type.extension;
        Path target = resolve(storedName);
        try (InputStream in = file.getInputStream()) {
            Files.createDirectories(root);
            Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new IllegalStateException("Could not store document", e);
        }

        EmployeeDocument doc = new EmployeeDocument();
        doc.setEmployeeId(employeeId);
        doc.setCategory(category);
        doc.setOriginalFilename(sanitizeFilename(file.getOriginalFilename(), type));
        doc.setStoredFilename(storedName);
        doc.setContentType(type.contentType);
        doc.setSizeBytes(file.getSize());
        doc.setUploadedBy(CurrentUser.label());
        doc.setUploadedAt(clock.instant());
        documents.save(doc);
        audit.record(AuditAction.EMPLOYEE_DOCUMENT_UPLOADED, "Employee", employeeId,
                "Uploaded " + category + " document for " + employee.fullName());
        return DocumentResponse.from(doc);
    }

    public record StoredDocument(Resource resource, String filename, String contentType) {
    }

    @Transactional(readOnly = true)
    public StoredDocument load(Long employeeId, Long documentId) {
        EmployeeDocument doc = documents.findByIdAndEmployeeId(documentId, employeeId)
                .orElseThrow(() -> new NotFoundException("Document", documentId));
        Path path = resolve(doc.getStoredFilename());
        if (!Files.exists(path)) {
            throw new NotFoundException("Document file", documentId);
        }
        return new StoredDocument(new FileSystemResource(path), doc.getOriginalFilename(), doc.getContentType());
    }

    @Transactional
    public void delete(Long employeeId, Long documentId) {
        EmployeeDocument doc = documents.findByIdAndEmployeeId(documentId, employeeId)
                .orElseThrow(() -> new NotFoundException("Document", documentId));
        documents.delete(doc);
        try {
            Files.deleteIfExists(resolve(doc.getStoredFilename()));
        } catch (IOException e) {
            throw new IllegalStateException("Could not delete document file", e);
        }
        audit.record(AuditAction.EMPLOYEE_DOCUMENT_DELETED, "Employee", employeeId,
                "Deleted document " + doc.getOriginalFilename());
    }

    private Path resolve(String storedName) {
        Path path = root.resolve(storedName).normalize();
        if (!path.startsWith(root)) {
            throw new IllegalStateException("Resolved path escapes the documents directory");
        }
        return path;
    }

    private static AllowedType detectType(MultipartFile file) {
        byte[] header = new byte[8];
        int read;
        try (InputStream in = file.getInputStream()) {
            read = in.readNBytes(header, 0, header.length);
        } catch (IOException e) {
            throw BusinessException.rule("UNREADABLE_FILE", "The file could not be read.");
        }
        for (AllowedType type : AllowedType.values()) {
            if (read >= type.magic.length && Arrays.equals(Arrays.copyOf(header, type.magic.length), type.magic)) {
                return type;
            }
        }
        throw BusinessException.rule("UNSUPPORTED_FILE_TYPE", "Only PDF, PNG and JPEG files are accepted.");
    }

    /** Keeps a display name only: strips paths and control characters, enforces the real extension. */
    static String sanitizeFilename(String original, AllowedType type) {
        String name = original == null ? "document" : Paths.get(original.replace('\\', '/')).getFileName().toString();
        name = name.replaceAll("[\\p{Cntrl}\"<>|:*?]", "_").trim();
        if (name.isEmpty()) {
            name = "document";
        }
        if (name.length() > 200) {
            name = name.substring(0, 200);
        }
        if (!name.toLowerCase().endsWith(type.extension) && !(type == AllowedType.JPEG
                && name.toLowerCase().endsWith(".jpeg"))) {
            name = name + type.extension;
        }
        return name;
    }
}
