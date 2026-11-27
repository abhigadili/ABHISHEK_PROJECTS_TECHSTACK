package com.hrportal.auth.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.hrportal.auth.dto.AuthDtos.ChangePasswordRequest;
import com.hrportal.auth.dto.AuthDtos.ForgotPasswordRequest;
import com.hrportal.auth.dto.AuthDtos.ForgotPasswordResponse;
import com.hrportal.auth.dto.AuthDtos.LoginRequest;
import com.hrportal.auth.dto.AuthDtos.LogoutRequest;
import com.hrportal.auth.dto.AuthDtos.RefreshRequest;
import com.hrportal.auth.dto.AuthDtos.RegisterUserRequest;
import com.hrportal.auth.dto.AuthDtos.ResetPasswordRequest;
import com.hrportal.auth.dto.AuthDtos.TokenResponse;
import com.hrportal.auth.dto.AuthDtos.UserResponse;
import com.hrportal.auth.service.AuthService;
import com.hrportal.auth.service.UserAdminService;
import com.hrportal.common.security.CurrentUser;
import com.hrportal.common.web.RequestContext;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

/** Thin controller: parsing, validation, delegation - no business logic here. */
@Tag(name = "Authentication")
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    private final AuthService auth;
    private final UserAdminService admin;
    private final RequestContext context;

    public AuthController(AuthService auth, UserAdminService admin, RequestContext context) {
        this.auth = auth;
        this.admin = admin;
        this.context = context;
    }

    @Operation(summary = "Login with username + password; returns access and refresh tokens")
    @PostMapping("/login")
    public TokenResponse login(@Valid @RequestBody LoginRequest req, jakarta.servlet.http.HttpServletRequest http) {
        return auth.login(req, clientIp(http));
    }

    @Operation(summary = "Exchange a refresh token for a new token pair (rotation)")
    @PostMapping("/refresh")
    public TokenResponse refresh(@Valid @RequestBody RefreshRequest req, jakarta.servlet.http.HttpServletRequest http) {
        return auth.refresh(req.refreshToken(), clientIp(http));
    }

    @Operation(summary = "Logout: revokes the refresh token and the current access token")
    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@RequestBody(required = false) LogoutRequest req) {
        auth.logout(CurrentUser.require(), req == null ? null : req.refreshToken());
    }

    @Operation(summary = "Current user profile, roles and permissions")
    @GetMapping("/me")
    public UserResponse me() {
        return auth.me();
    }

    @Operation(summary = "Change own password (revokes all sessions)")
    @PostMapping("/change-password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void changePassword(@Valid @RequestBody ChangePasswordRequest req) {
        auth.changePassword(req);
    }

    @Operation(summary = "Start the password reset workflow (always answers 202, never reveals whether the e-mail exists)")
    @PostMapping("/forgot-password")
    public ResponseEntity<ForgotPasswordResponse> forgotPassword(@Valid @RequestBody ForgotPasswordRequest req) {
        return ResponseEntity.accepted().body(auth.forgotPassword(req));
    }

    @Operation(summary = "Complete the password reset with the e-mailed token")
    @PostMapping("/reset-password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resetPassword(@Valid @RequestBody ResetPasswordRequest req) {
        auth.resetPassword(req);
    }

    @Operation(summary = "Provision a user account (HR / super admin)")
    @PostMapping("/register")
    @PreAuthorize("hasAnyRole('HR_ADMIN','SUPER_ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponse register(@Valid @RequestBody RegisterUserRequest req) {
        return admin.register(req);
    }

    private String clientIp(jakarta.servlet.http.HttpServletRequest http) {
        String fwd = http.getHeader("X-Forwarded-For");
        return fwd != null && !fwd.isBlank() ? fwd.split(",")[0].trim() : http.getRemoteAddr();
    }
}
