package com.hrportal.document.service;

import java.io.IOException;
import java.io.InputStream;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.hrportal.common.audit.AuditService;
import com.hrportal.common.exception.BadRequestException;
import com.hrportal.common.exception.ForbiddenOperationException;
import com.hrportal.common.exception.ResourceNotFoundException;
import com.hrportal.common.persistence.BeanMapper;
import com.hrportal.common.security.CurrentUser;
import com.hrportal.common.security.Role;
import com.hrportal.common.storage.FileStorage;
import com.hrportal.common.storage.FileStorage.StoredFile;
import com.hrportal.document.dto.DocumentDtos.DocumentResponse;
import com.hrportal.document.dto.DocumentDtos.HistoryResponse;
import com.hrportal.document.dto.DocumentDtos.PermissionRequest;
import com.hrportal.document.dto.DocumentDtos.PermissionResponse;
import com.hrportal.document.entity.Document;
import com.hrportal.document.entity.DocumentCategory;
import com.hrportal.document.entity.DocumentHistory;
import com.hrportal.document.entity.DocumentPermission;
import com.hrportal.document.entity.Enums.AccessLevel;
import com.hrportal.document.entity.Enums.DocumentStatus;
import com.hrportal.document.entity.Enums.GranteeType;
import com.hrportal.document.entity.Enums.Source;
import com.hrportal.document.producer.DocumentEventProducer;
import com.hrportal.document.repository.DocumentRepositories.CategoryRepository;
import com.hrportal.document.repository.DocumentRepositories.DocumentRepository;
import com.hrportal.document.repository.DocumentRepositories.HistoryRepository;
import com.hrportal.document.repository.DocumentRepositories.PermissionRepository;

/** Upload (with versioning), secure download, verification workflow, permissions and history of employee documents. */
@Service
public class DocumentService {
    private static final Logger log = LoggerFactory.getLogger(DocumentService.class);

    private final DocumentRepository documents;
    private final CategoryRepository categories;
    private final PermissionRepository permissions;
    private final HistoryRepository history;
    private final FileStorage storage;
    private final DocumentAccess access;
    private final DocumentEventProducer producer;
    private final AuditService audit;

    public DocumentService(DocumentRepository documents, CategoryRepository categories, PermissionRepository permissions, HistoryRepository history, FileStorage storage,
                           DocumentAccess access, DocumentEventProducer producer, AuditService audit) {
        this.documents = documents;
        this.categories = categories;
        this.permissions = permissions;
        this.history = history;
        this.storage = storage;
        this.access = access;
        this.producer = producer;
        this.audit = audit;
    }

    // ------------------------------------------------------------------ upload
    @Transactional
    public DocumentResponse upload(MultipartFile file, String ownerEmployeeId, String categoryCode, String title, LocalDate expiryDate) {
        if (file == null || file.isEmpty()) throw new BadRequestException("The file is empty");
        DocumentCategory category = categories.findByCodeIgnoreCase(categoryCode).filter(DocumentCategory::isActive).orElseThrow(() -> new BadRequestException("Unknown document category: " + categoryCode));
        String me = CurrentUser.employeeId();
        String owner = ownerEmployeeId == null || ownerEmployeeId.isBlank() ? me : ownerEmployeeId;
        if (owner == null) throw new BadRequestException("ownerEmployeeId is required for accounts that are not linked to an employee");
        boolean hr = CurrentUser.hasAnyRole(Role.HR_ADMIN, Role.SUPER_ADMIN);
        if (!owner.equals(me) && !hr) throw new ForbiddenOperationException("Only HR can upload documents for another employee");
        if (owner.equals(me) && !hr && !category.isSelfUploadAllowed()) throw new ForbiddenOperationException("Documents of category " + category.getCode() + " are uploaded by HR");
        String detected;
        try {
            detected = FileTypeSniffer.detect(file).orElseThrow(() -> new BadRequestException("Unsupported or unrecognised file type (allowed: PDF, PNG, JPEG, DOCX, TXT)"));
        } catch (IOException e) {
            throw new BadRequestException("The file cannot be read");
        }
        if (file.getContentType() != null && !file.getContentType().equalsIgnoreCase(detected) && !file.getContentType().equals("application/octet-stream")) {
            throw new BadRequestException("The declared content type " + file.getContentType() + " does not match the file content (" + detected + ")");
        }
        String docTitle = title == null || title.isBlank() ? file.getOriginalFilename() : title.trim();
        StoredFile stored;
        try (InputStream in = file.getInputStream()) {
            stored = storage.store("documents/" + owner, file.getOriginalFilename(), in);
        } catch (IOException e) {
            throw new BadRequestException("The file could not be stored");
        }
        Document d = new Document();
        List<Document> previous = documents.findByOwnerEmployeeIdAndTitleAndCategoryIdOrderByVersionNumberDesc(owner, docTitle, category.getId());
        if (!previous.isEmpty()) {                          // same title + category = a new VERSION of the document
            Document p = previous.get(0);
            p.setCurrentVersion(false);
            documents.save(p);
            d.setVersionNumber(p.getVersionNumber() + 1);
            d.setPreviousVersionId(p.getId());
        }
        d.setOwnerEmployeeId(owner);
        d.setCategoryId(category.getId());
        d.setTitle(docTitle);
        d.setFileName(file.getOriginalFilename() == null ? "file" : file.getOriginalFilename());
        d.setContentType(detected);
        d.setSizeBytes(stored.sizeBytes());
        d.setSha256(stored.sha256());
        d.setStoragePath(stored.relativePath());
        d.setUploadedBy(CurrentUser.auditName());
        d.setExpiryDate(expiryDate != null ? expiryDate : category.getDefaultExpiryMonths() == null ? null : LocalDate.now().plusMonths(category.getDefaultExpiryMonths()));
        if (!category.isRequiresVerification()) d.setStatus(DocumentStatus.APPROVED);
        d = documents.save(d);
        log(d.getId(), previous.isEmpty() ? "UPLOADED" : "REPLACED", "v" + d.getVersionNumber() + " " + d.getFileName() + " (" + d.getSizeBytes() + " bytes)");
        audit.record("Document", d.getId(), "UPLOADED", owner + " " + category.getCode());
        return toResponse(d, category);
    }

    /** Registers metadata of a file another service already wrote into the shared store (payslips). Idempotent per storage path. */
    @Transactional
    public void registerExisting(String ownerEmployeeId, String categoryCode, String title, String fileName, String storagePath, Source source) {
        if (documents.findByStoragePath(storagePath).isPresent()) return;
        DocumentCategory category = categories.findByCodeIgnoreCase(categoryCode).orElseThrow(() -> new IllegalStateException("Missing category " + categoryCode));
        long size = 0;
        String sha = "n/a";
        try (InputStream in = storage.open(storagePath)) {
            java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA-256");
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) {
                md.update(buf, 0, n);
                size += n;
            }
            sha = java.util.HexFormat.of().formatHex(md.digest());
        } catch (IOException | java.security.NoSuchAlgorithmException e) {
            log.warn("Registered {} without reading the file ({}): shared storage not mounted here?", storagePath, e.toString());
        }
        Document d = new Document();
        d.setOwnerEmployeeId(ownerEmployeeId);
        d.setCategoryId(category.getId());
        d.setTitle(title);
        d.setFileName(fileName);
        d.setContentType("application/pdf");
        d.setSizeBytes(size);
        d.setSha256(sha);
        d.setStoragePath(storagePath);
        d.setUploadedBy("system");
        d.setSource(source);
        d.setStatus(DocumentStatus.APPROVED);
        d = documents.save(d);
        log(d.getId(), "REGISTERED", source + " " + fileName);
    }

    // ------------------------------------------------------------------ read
    public record Download(String fileName, String contentType, long size, Resource resource) { }

    @Transactional
    public Download download(String id) {
        Document d = find(id);
        DocumentCategory c = category(d);
        access.requireRead(d, c, permissions.findByDocumentId(id), AccessLevel.DOWNLOAD);
        try {
            InputStream in = storage.open(d.getStoragePath());
            log(id, "DOWNLOADED", CurrentUser.auditName());
            return new Download(d.getFileName(), d.getContentType(), d.getSizeBytes(), new InputStreamResource(in));
        } catch (IOException e) {
            throw new BadRequestException("The file is not available in the store");
        }
    }

    @Transactional(readOnly = true)
    public DocumentResponse get(String id) {
        Document d = find(id);
        DocumentCategory c = category(d);
        access.requireRead(d, c, permissions.findByDocumentId(id), AccessLevel.VIEW);
        return toResponse(d, c);
    }

    @Transactional(readOnly = true)
    public List<DocumentResponse> forEmployee(String employeeId) {
        List<Document> list = documents.findByOwnerEmployeeIdAndCurrentVersionTrueOrderByCreatedAtDesc(employeeId);
        Map<String, DocumentCategory> cats = categories.findAll().stream().collect(Collectors.toMap(DocumentCategory::getId, c -> c));
        Map<String, List<DocumentPermission>> grants = new HashMap<>();
        permissions.findAll().forEach(p -> grants.computeIfAbsent(p.getDocumentId(), k -> new java.util.ArrayList<>()).add(p));
        return list.stream().filter(d -> access.canRead(d, cats.get(d.getCategoryId()), grants.getOrDefault(d.getId(), List.of()), AccessLevel.VIEW)).map(d -> toResponse(d, cats.get(d.getCategoryId()))).toList();
    }

    @Transactional(readOnly = true)
    public List<DocumentResponse> versions(String id) {
        Document d = find(id);
        DocumentCategory c = category(d);
        access.requireRead(d, c, permissions.findByDocumentId(id), AccessLevel.VIEW);
        return documents.findByOwnerEmployeeIdAndTitleAndCategoryIdOrderByVersionNumberDesc(d.getOwnerEmployeeId(), d.getTitle(), d.getCategoryId()).stream().map(x -> toResponse(x, c)).toList();
    }

    @Transactional(readOnly = true)
    public List<DocumentResponse> pendingVerification() {
        return documents.findByStatusAndCurrentVersionTrueOrderByCreatedAtAsc(DocumentStatus.UPLOADED).stream().map(d -> toResponse(d, category(d))).toList();
    }

    @Transactional(readOnly = true)
    public List<DocumentResponse> expiring(int days) {
        return documents.findExpiringBy(LocalDate.now().plusDays(Math.max(1, Math.min(days, 365)))).stream().map(d -> toResponse(d, category(d))).toList();
    }

    // ------------------------------------------------------------------ verification workflow
    @Transactional
    public DocumentResponse verify(String id) {
        Document d = find(id);
        if (d.getStatus() != DocumentStatus.UPLOADED) throw new BadRequestException("Only an UPLOADED document can be verified (current: " + d.getStatus() + ")");
        d.setStatus(DocumentStatus.VERIFIED);
        decide(d, null);
        log(id, "VERIFIED", null);
        return toResponse(d, category(d));
    }

    @Transactional
    public DocumentResponse approve(String id) {
        Document d = find(id);
        if (d.getStatus() != DocumentStatus.UPLOADED && d.getStatus() != DocumentStatus.VERIFIED) throw new BadRequestException("The document is " + d.getStatus());
        d.setStatus(DocumentStatus.APPROVED);
        decide(d, null);
        log(id, "APPROVED", null);
        producer.notifyOwner(d, "DOCUMENT_APPROVED", null);
        audit.record("Document", id, "APPROVED", null);
        return toResponse(d, category(d));
    }

    @Transactional
    public DocumentResponse reject(String id, String reason) {
        Document d = find(id);
        if (d.getStatus() == DocumentStatus.REJECTED) throw new BadRequestException("The document is already rejected");
        if (reason == null || reason.isBlank()) throw new BadRequestException("A reason is required to reject a document");
        d.setStatus(DocumentStatus.REJECTED);
        d.setRejectionReason(reason);
        decide(d, reason);
        log(id, "REJECTED", reason);
        producer.notifyOwner(d, "DOCUMENT_REJECTED", reason);
        audit.record("Document", id, "REJECTED", reason);
        return toResponse(d, category(d));
    }

    // ------------------------------------------------------------------ permissions
    @Transactional
    public PermissionResponse grant(String id, PermissionRequest req) {
        Document d = find(id);
        if (!access.isOwner(d) && !CurrentUser.hasAnyRole(Role.HR_ADMIN, Role.SUPER_ADMIN)) throw new ForbiddenOperationException("Only the owner or HR can grant access");
        DocumentPermission p = new DocumentPermission();
        p.setDocumentId(id);
        p.setGranteeType(GranteeType.valueOf(req.granteeType()));
        p.setGranteeId(req.granteeId());
        if (req.accessLevel() != null) p.setAccessLevel(AccessLevel.valueOf(req.accessLevel()));
        p.setExpiresAt(req.expiresAt());
        p = permissions.save(p);
        log(id, "PERMISSION_GRANTED", req.granteeType() + ":" + req.granteeId() + " " + p.getAccessLevel());
        return BeanMapper.toRecord(p, PermissionResponse.class);
    }

    @Transactional
    public void revoke(String id, String permissionId) {
        Document d = find(id);
        if (!access.isOwner(d) && !CurrentUser.hasAnyRole(Role.HR_ADMIN, Role.SUPER_ADMIN)) throw new ForbiddenOperationException("Only the owner or HR can revoke access");
        DocumentPermission p = permissions.findById(permissionId).filter(x -> x.getDocumentId().equals(id)).orElseThrow(() -> ResourceNotFoundException.of("Permission", permissionId));
        permissions.delete(p);
        log(id, "PERMISSION_REVOKED", p.getGranteeType() + ":" + p.getGranteeId());
    }

    @Transactional(readOnly = true)
    public List<PermissionResponse> permissionsOf(String id) {
        Document d = find(id);
        if (!access.isOwner(d) && !CurrentUser.hasAnyRole(Role.HR_ADMIN, Role.SUPER_ADMIN)) throw new ForbiddenOperationException("Only the owner or HR can list permissions");
        return BeanMapper.toRecords(permissions.findByDocumentId(id), PermissionResponse.class);
    }

    @Transactional(readOnly = true)
    public List<HistoryResponse> historyOf(String id) {
        Document d = find(id);
        access.requireRead(d, category(d), permissions.findByDocumentId(id), AccessLevel.VIEW);
        return BeanMapper.toRecords(history.findByDocumentIdOrderByCreatedAtAsc(id), HistoryResponse.class);
    }

    // ------------------------------------------------------------------ helpers
    private void decide(Document d, String reason) {
        d.setDecidedBy(CurrentUser.auditName());
        d.setDecidedAt(Instant.now());
        documents.save(d);
    }

    private void log(String documentId, String action, String detail) {
        DocumentHistory h = new DocumentHistory();
        h.setDocumentId(documentId);
        h.setAction(action);
        h.setDetail(detail);
        history.save(h);
    }

    private Document find(String id) {
        return documents.findById(id).orElseThrow(() -> ResourceNotFoundException.of("Document", id));
    }

    private DocumentCategory category(Document d) {
        return categories.findById(d.getCategoryId()).orElse(null);
    }

    private DocumentResponse toResponse(Document d, DocumentCategory c) {
        return new DocumentResponse(d.getId(), d.getOwnerEmployeeId(), d.getCategoryId(), c == null ? null : c.getCode(), d.getTitle(), d.getFileName(), d.getContentType(), d.getSizeBytes(),
                d.getSha256(), d.getStatus().name(), d.getExpiryDate(), d.getUploadedBy(), d.getDecidedBy(), d.getDecidedAt(), d.getRejectionReason(), d.getSource().name(),
                d.getVersionNumber(), d.isCurrentVersion(), d.getCreatedAt());
    }
}
