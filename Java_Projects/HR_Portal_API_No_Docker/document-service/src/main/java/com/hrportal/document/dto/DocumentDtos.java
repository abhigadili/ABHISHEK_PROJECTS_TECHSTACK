package com.hrportal.document.dto;

import java.time.Instant;
import java.time.LocalDate;

import com.hrportal.common.validation.ValidEmployeeId;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class DocumentDtos {
    private DocumentDtos() {
    }

    public record CategoryRequest(@NotBlank @Pattern(regexp = "^[A-Z][A-Z0-9_]{1,29}$", message = "code must be UPPER_SNAKE_CASE") String code, @NotBlank @Size(max = 100) String name,
                                  @Size(max = 300) String description, Boolean sensitive, Boolean requiresVerification, Boolean selfUploadAllowed,
                                  @Pattern(regexp = "^[A-Z_]+(,[A-Z_]+)*$", message = "comma separated role names") String readRoles, @Min(1) Integer defaultExpiryMonths, Boolean active) { }

    public record CategoryResponse(String id, String code, String name, String description, boolean sensitive, boolean requiresVerification, boolean selfUploadAllowed,
                                   String readRoles, Integer defaultExpiryMonths, boolean active) { }

    public record DocumentResponse(String id, String ownerEmployeeId, String categoryId, String categoryCode, String title, String fileName, String contentType, long sizeBytes,
                                   String sha256, String status, LocalDate expiryDate, String uploadedBy, String decidedBy, Instant decidedAt, String rejectionReason,
                                   String source, int versionNumber, boolean currentVersion, Instant createdAt) { }

    public record DecisionRequest(@Size(max = 500) String reason) { }

    public record PermissionRequest(@NotBlank @Pattern(regexp = "EMPLOYEE|ROLE") String granteeType, @NotBlank @Size(max = 60) String granteeId,
                                    @Pattern(regexp = "VIEW|DOWNLOAD") String accessLevel, Instant expiresAt) { }

    public record PermissionResponse(String id, String documentId, String granteeType, String granteeId, String accessLevel, Instant expiresAt, String createdBy) { }

    public record HistoryResponse(String id, String documentId, String action, String detail, String createdBy, Instant createdAt) { }

    @SuppressWarnings("unused")
    private static final Class<?>[] KEEP = {ValidEmployeeId.class, NotNull.class};
}
