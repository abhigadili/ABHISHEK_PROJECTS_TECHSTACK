package com.fooddelivery.user.web;

import com.fooddelivery.user.domain.Role;
import com.fooddelivery.user.domain.User;
import com.fooddelivery.user.domain.UserStatus;
import com.fooddelivery.user.validation.PasswordsMatch;
import com.fooddelivery.user.validation.StrongPassword;
import jakarta.validation.constraints.*;

import java.time.Instant;
import java.util.List;

/** Request/response DTOs: JPA entities are never exposed through the API. */
public final class Dtos {
    private Dtos() {}

    @PasswordsMatch
    public record RegisterRequest(
            @NotBlank @Size(min = 3, max = 50) @Pattern(regexp = "[A-Za-z0-9._-]+", message = "letters, digits . _ - only") String username,
            @NotBlank @Email @Size(max = 150) String email,
            @NotBlank @StrongPassword String password,
            @NotBlank String confirmPassword,
            @NotBlank @Size(max = 120) String fullName,
            @Pattern(regexp = "^[0-9+\\- ]{7,20}$", message = "invalid phone number") String phone,
            @NotNull Role role) {}

    public record LoginRequest(@NotBlank String usernameOrEmail, @NotBlank String password) {}
    public record RefreshRequest(@NotBlank String refreshToken) {}
    public record LogoutRequest(String refreshToken) {}
    public record ForgotPasswordRequest(@NotBlank @Email String email) {}
    public record ResetPasswordRequest(@NotBlank String token, @NotBlank @StrongPassword String newPassword) {}
    public record ChangePasswordRequest(@NotBlank String currentPassword, @NotBlank @StrongPassword String newPassword) {}
    public record UpdateProfileRequest(@NotBlank @Size(max = 120) String fullName,
                                       @Pattern(regexp = "^[0-9+\\- ]{7,20}$", message = "invalid phone number") String phone) {}
    public record StatusRequest(@NotNull UserStatus status) {}
    public record CreateAdminRequest(@NotBlank @Size(min = 3, max = 50) String username, @NotBlank @Email String email,
                                     @NotBlank @StrongPassword String password, @NotBlank String fullName, boolean superAdmin) {}

    public record UserDto(Long id, String username, String email, String fullName, String phone, UserStatus status,
                          List<String> roles, Instant createdAt, Instant lastLoginAt) {
        public static UserDto from(User u) {
            return new UserDto(u.getId(), u.getUsername(), u.getEmail(), u.getFullName(), u.getPhone(), u.getStatus(),
                    u.getRoles().stream().map(Enum::name).sorted().toList(), u.getCreatedAt(), u.getLastLoginAt());
        }
    }

    public record ContactDto(Long id, String fullName, String email, String phone) {
        public static ContactDto from(User u) { return new ContactDto(u.getId(), u.getFullName(), u.getEmail(), u.getPhone()); }
    }

    public record AuthResponse(String accessToken, String refreshToken, String tokenType, long expiresInSeconds, UserDto user) {}
    public record MessageResponse(String message, String devResetToken) {}
}
