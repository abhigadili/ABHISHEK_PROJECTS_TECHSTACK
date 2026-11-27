package com.hrportal.auth.dto;

import java.time.Instant;
import java.util.List;
import java.util.Set;

import com.hrportal.common.validation.StrongPassword;
import com.hrportal.common.validation.ValidEmployeeId;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Request / response records of the authentication API. */
public final class AuthDtos {
    private AuthDtos() {
    }

    public record LoginRequest(@NotBlank @Size(max = 150) String username, @NotBlank @Size(max = 200) String password) { }

    public record RefreshRequest(@NotBlank String refreshToken) { }

    public record LogoutRequest(String refreshToken) { }

    public record TokenResponse(String accessToken, String refreshToken, String tokenType, long expiresInSeconds,
                                boolean mustChangePassword, UserResponse user) { }

    public record RegisterUserRequest(
            @NotBlank @Pattern(regexp = "^[A-Za-z0-9._-]{3,60}$", message = "username must be 3-60 chars: letters, digits, . _ -") String username,
            @NotBlank @Email @Size(max = 150) String email,
            @NotBlank @StrongPassword String password,
            @ValidEmployeeId String employeeId,
            @NotEmpty Set<@NotBlank String> roles,
            Boolean mustChangePassword) { }

    public record ChangePasswordRequest(@NotBlank String currentPassword, @NotBlank @StrongPassword String newPassword) { }

    public record ForgotPasswordRequest(@NotBlank @Email String email) { }

    public record ResetPasswordRequest(@NotBlank String token, @NotBlank @StrongPassword String newPassword) { }

    public record AdminResetPasswordRequest(@NotBlank @StrongPassword String newPassword) { }

    public record ForgotPasswordResponse(String message, String resetToken) { }

    public record AssignRolesRequest(@NotEmpty Set<@NotBlank String> roles) { }

    public record StatusRequest(@NotBlank @Pattern(regexp = "ACTIVE|INACTIVE", message = "status must be ACTIVE or INACTIVE") String status) { }

    public record EmployeeMappingRequest(@NotBlank @ValidEmployeeId String employeeId) { }

    public record UserResponse(String id, String username, String email, String employeeId, String status,
                               List<String> roles, List<String> permissions, boolean mustChangePassword,
                               Instant lastLoginAt, Instant lockedUntil, Instant createdAt) { }

    public record RoleRequest(@NotBlank @Pattern(regexp = "^[A-Z][A-Z0-9_]{2,39}$", message = "role name must be UPPER_SNAKE_CASE") String name,
                              @Size(max = 255) String description, Set<String> permissions) { }

    public record RolePermissionsRequest(@jakarta.validation.constraints.NotNull Set<String> permissions) { }

    public record RoleResponse(String id, String name, String description, List<String> permissions) { }

    public record PermissionRequest(@NotBlank @Pattern(regexp = "^[A-Z][A-Z0-9_]{2,59}$", message = "code must be UPPER_SNAKE_CASE") String code,
                                    @Size(max = 255) String description) { }

    public record PermissionResponse(String id, String code, String description) { }
}
