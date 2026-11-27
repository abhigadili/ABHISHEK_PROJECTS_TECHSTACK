package com.hospital.hospital.dto;

import java.util.Arrays;

import com.hospital.common.security.Role;
import com.hospital.hospital.domain.Department;
import com.hospital.hospital.domain.Hospital;
import com.hospital.hospital.domain.UserAccount;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

public final class HospitalDtos {
    private HospitalDtos() {
    }

    @Data
    public static class HospitalRequest {
        @NotBlank @Size(max = 150) private String name;
        @NotBlank @Size(max = 30) private String code;
        @Size(max = 255) private String address;
        @Size(max = 80) private String city;
        @Size(max = 30) private String phone;
        @Email @Size(max = 120) private String email;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class HospitalResponse {
        private Long id;
        private String name;
        private String code;
        private String address;
        private String city;
        private String phone;
        private String email;
        private boolean active;

        public static HospitalResponse from(Hospital h) {
            return new HospitalResponse(h.getId(), h.getName(), h.getCode(), h.getAddress(), h.getCity(), h.getPhone(), h.getEmail(), h.isActive());
        }
    }

    @Data
    public static class DepartmentRequest {
        @NotBlank @Size(max = 100) private String name;
        @Size(max = 255) private String description;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DepartmentResponse {
        private Long id;
        private Long hospitalId;
        private String name;
        private String description;
        private boolean active;

        public static DepartmentResponse from(Department d) {
            return new DepartmentResponse(d.getId(), d.getHospital().getId(), d.getName(), d.getDescription(), d.isActive());
        }
    }

    @Data
    public static class LoginRequest {
        @NotBlank private String username;
        @NotBlank private String password;
    }

    @Data
    public static class RegisterRequest {
        @NotBlank @Size(min = 4, max = 60) @Pattern(regexp = "^[A-Za-z0-9._-]+$", message = "only letters, digits, '.', '_' and '-' are allowed") private String username;
        @NotBlank @Email @Size(max = 120) private String email;
        @NotBlank @Size(min = 8, max = 72) private String password;
    }

    @Data
    public static class CreateUserRequest {
        @NotBlank @Size(min = 4, max = 60) @Pattern(regexp = "^[A-Za-z0-9._-]+$") private String username;
        @NotBlank @Email @Size(max = 120) private String email;
        @NotBlank @Size(min = 8, max = 72) private String password;
        @NotNull private Role role;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UserResponse {
        private Long id;
        private String username;
        private String email;
        private Role role;
        private boolean enabled;

        public static UserResponse from(UserAccount u) {
            return new UserResponse(u.getId(), u.getUsername(), u.getEmail(), u.getRole(), u.isEnabled());
        }
    }

    @Data
    @AllArgsConstructor
    public static class TokenResponse {
        private String accessToken;
        private String tokenType;
        private long expiresInSeconds;
        private UserResponse user;
    }

    @Data
    public static class EnabledRequest {
        @NotNull private Boolean enabled;
    }

    public static String roles() {
        return Arrays.toString(Role.values());
    }
}
