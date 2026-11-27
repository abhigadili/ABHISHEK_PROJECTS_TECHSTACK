package com.fooddelivery.user.web;

import com.fooddelivery.user.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@Tag(name = "Authentication")
public class AuthController {
    private final AuthService auth;

    public AuthController(AuthService auth) { this.auth = auth; }

    @Operation(summary = "Register a CUSTOMER, RESTAURANT_OWNER or DELIVERY_PARTNER account")
    @PostMapping("/register")
    public ResponseEntity<Dtos.UserDto> register(@Valid @RequestBody Dtos.RegisterRequest r) {
        return ResponseEntity.status(HttpStatus.CREATED).body(auth.register(r));
    }

    @Operation(summary = "Login: returns an access token (30 min) and a rotating refresh token (7 days)")
    @PostMapping("/login")
    public Dtos.AuthResponse login(@Valid @RequestBody Dtos.LoginRequest r) { return auth.login(r); }

    @PostMapping("/refresh")
    public Dtos.AuthResponse refresh(@Valid @RequestBody Dtos.RefreshRequest r) { return auth.refresh(r.refreshToken()); }

    @Operation(summary = "Logout: revokes the refresh token and deny-lists the current access token")
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@RequestBody(required = false) Dtos.LogoutRequest r) {
        auth.logout(r == null ? null : r.refreshToken());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/forgot-password")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public Dtos.MessageResponse forgot(@Valid @RequestBody Dtos.ForgotPasswordRequest r) { return auth.forgotPassword(r.email()); }

    @PostMapping("/reset-password")
    public ResponseEntity<Void> reset(@Valid @RequestBody Dtos.ResetPasswordRequest r) {
        auth.resetPassword(r);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/change-password")
    public ResponseEntity<Void> change(@Valid @RequestBody Dtos.ChangePasswordRequest r) {
        auth.changePassword(r);
        return ResponseEntity.noContent().build();
    }
}
