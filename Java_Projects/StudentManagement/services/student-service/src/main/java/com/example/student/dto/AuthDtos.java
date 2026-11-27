package com.example.student.dto;

import com.example.student.entity.Role;
import com.example.student.validation.ValidPhoneNumber;
import jakarta.validation.constraints.*;

public final class AuthDtos {
    private AuthDtos() {}

    public record RegisterRequest(
            @NotBlank @Size(min = 3, max = 50) @Pattern(regexp = "^[A-Za-z0-9._-]+$", message = "letters, digits, . _ - only") String username,
            @NotBlank @Email @Size(max = 100) String email,
            @NotBlank @Size(min = 8, max = 72) String password,
            Role role,
            @Size(max = 50) String firstName,
            @Size(max = 50) String lastName,
            @ValidPhoneNumber String phoneNumber) {
    }

    public record LoginRequest(@NotBlank String username, @NotBlank String password) {
    }

    public record RefreshRequest(@NotBlank String refreshToken) {
    }

    public record TokenResponse(String accessToken, String refreshToken, String tokenType, long expiresInSeconds,
                                String username, Role role, Long studentId) {
    }

    public record UserResponse(Long userId, String username, String email, Role role, Long studentId) {
    }
}
