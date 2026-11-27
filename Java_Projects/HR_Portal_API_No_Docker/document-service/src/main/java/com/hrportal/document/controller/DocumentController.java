package com.hrportal.document.controller;

import java.time.LocalDate;
import java.util.List;

import org.springframework.core.io.Resource;
import org.springframework.format.annotation.DateTimeFormat;
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

import com.hrportal.common.exception.ForbiddenOperationException;
import com.hrportal.common.security.CurrentUser;
import com.hrportal.document.dto.DocumentDtos.CategoryRequest;
import com.hrportal.document.dto.DocumentDtos.CategoryResponse;
import com.hrportal.document.dto.DocumentDtos.DecisionRequest;
import com.hrportal.document.dto.DocumentDtos.DocumentResponse;
import com.hrportal.document.dto.DocumentDtos.HistoryResponse;
import com.hrportal.document.dto.DocumentDtos.PermissionRequest;
import com.hrportal.document.dto.DocumentDtos.PermissionResponse;
import com.hrportal.document.service.CategoryService;
import com.hrportal.document.service.DocumentService;
import com.hrportal.document.service.DocumentService.Download;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@Tag(name = "Documents")
@RestController
@RequestMapping("/api/v1/documents")
public class DocumentController {
    private final DocumentService service;
    private final CategoryService categories;

    public DocumentController(DocumentService service, CategoryService categories) {
        this.service = service;
        this.categories = categories;
    }

    @Operation(summary = "Upload a document (multipart): allow-listed types, content sniffing, versioning by title + category")
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public DocumentResponse upload(@RequestPart("file") MultipartFile file, @RequestParam String categoryCode, @RequestParam(required = false) String ownerEmployeeId,
                                   @RequestParam(required = false) String title, @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate expiryDate) {
        return service.upload(file, ownerEmployeeId, categoryCode, title, expiryDate);
    }

    @GetMapping("/me")
    public List<DocumentResponse> mine() {
        String me = CurrentUser.employeeId();
        if (me == null) throw new ForbiddenOperationException("Your account is not linked to an employee record");
        return service.forEmployee(me);
    }

    @Operation(summary = "Documents of an employee that the caller is allowed to see")
    @GetMapping("/employee/{employeeId}")
    public List<DocumentResponse> forEmployee(@PathVariable String employeeId) {
        return service.forEmployee(employeeId);
    }

    @GetMapping("/{id}")
    public DocumentResponse get(@PathVariable String id) {
        return service.get(id);
    }

    @Operation(summary = "Download: owner, category read roles, or an explicit permission; every download is recorded")
    @GetMapping("/{id}/download")
    public ResponseEntity<Resource> download(@PathVariable String id) {
        Download d = service.download(id);
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(d.contentType())).contentLength(d.size())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(d.fileName()).build().toString())
                .header("X-Content-Type-Options", "nosniff").body(d.resource());
    }

    @GetMapping("/{id}/versions")
    public List<DocumentResponse> versions(@PathVariable String id) {
        return service.versions(id);
    }

    @GetMapping("/{id}/history")
    public List<HistoryResponse> history(@PathVariable String id) {
        return service.historyOf(id);
    }

    @GetMapping("/pending-verification")
    @PreAuthorize("hasAuthority('PERM_DOCUMENT_VERIFY')")
    public List<DocumentResponse> pending() {
        return service.pendingVerification();
    }

    @GetMapping("/expiring")
    @PreAuthorize("hasAuthority('PERM_DOCUMENT_VERIFY')")
    public List<DocumentResponse> expiring(@RequestParam(defaultValue = "30") int days) {
        return service.expiring(days);
    }

    @PostMapping("/{id}/verify")
    @PreAuthorize("hasAuthority('PERM_DOCUMENT_VERIFY')")
    public DocumentResponse verify(@PathVariable String id) {
        return service.verify(id);
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize("hasAuthority('PERM_DOCUMENT_VERIFY')")
    public DocumentResponse approve(@PathVariable String id) {
        return service.approve(id);
    }

    @PostMapping("/{id}/reject")
    @PreAuthorize("hasAuthority('PERM_DOCUMENT_VERIFY')")
    public DocumentResponse reject(@PathVariable String id, @Valid @RequestBody DecisionRequest req) {
        return service.reject(id, req.reason());
    }

    @PostMapping("/{id}/permissions")
    @ResponseStatus(HttpStatus.CREATED)
    public PermissionResponse grant(@PathVariable String id, @Valid @RequestBody PermissionRequest req) {
        return service.grant(id, req);
    }

    @GetMapping("/{id}/permissions")
    public List<PermissionResponse> permissions(@PathVariable String id) {
        return service.permissionsOf(id);
    }

    @DeleteMapping("/{id}/permissions/{permissionId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void revoke(@PathVariable String id, @PathVariable String permissionId) {
        service.revoke(id, permissionId);
    }

    // ---- categories
    @GetMapping("/categories")
    public List<CategoryResponse> categories() {
        return categories.all();
    }

    @PostMapping("/categories")
    @PreAuthorize("hasAnyRole('HR_ADMIN','SUPER_ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public CategoryResponse createCategory(@Valid @RequestBody CategoryRequest req) {
        return categories.create(req);
    }

    @PutMapping("/categories/{id}")
    @PreAuthorize("hasAnyRole('HR_ADMIN','SUPER_ADMIN')")
    public CategoryResponse updateCategory(@PathVariable String id, @Valid @RequestBody CategoryRequest req) {
        return categories.update(id, req);
    }
}
