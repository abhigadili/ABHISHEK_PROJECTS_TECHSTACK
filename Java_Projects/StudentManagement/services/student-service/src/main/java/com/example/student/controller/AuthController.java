package com.example.student.controller;

import com.example.common.security.AuthenticatedUser;
import com.example.student.dto.AuthDtos.*;
import com.example.student.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@Tag(name = "Authentication", description = "Registration, login, refresh-token rotation (JWT). Public except /me.")
public class AuthController {
    private final AuthService auth;

    public AuthController(AuthService auth) { this.auth = auth; }

    @PostMapping("/register")
    @Operation(summary = "Register a user", description = "Anonymous callers create STUDENT accounts (firstName/lastName required). An ADMIN token may also create STAFF/ADMIN accounts.")
    @ApiResponse(responseCode = "201", description = "Registered")
    public ResponseEntity<UserResponse> register(@Valid @RequestBody RegisterRequest request) {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        AuthenticatedUser caller = a != null && a.getPrincipal() instanceof AuthenticatedUser u ? u : null;
        return ResponseEntity.status(HttpStatus.CREATED).body(auth.register(request, caller));
    }

    @PostMapping("/login")
    @Operation(summary = "Login with username (or email) and password")
    public TokenResponse login(@Valid @RequestBody LoginRequest request) { return auth.login(request); }

    @PostMapping("/refresh")
    @Operation(summary = "Exchange a refresh token for a new access+refresh token pair (rotation)")
    public TokenResponse refresh(@Valid @RequestBody RefreshRequest request) { return auth.refresh(request.refreshToken()); }

    @PostMapping("/logout")
    @Operation(summary = "Revoke a refresh token")
    public ResponseEntity<Void> logout(@Valid @RequestBody RefreshRequest request) {
        auth.logout(request.refreshToken());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me")
    @Operation(summary = "Current user")
    public UserResponse me(@org.springframework.security.core.annotation.AuthenticationPrincipal AuthenticatedUser user) { return auth.me(user); }
}
