package com.hospital.hospital.web;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import com.hospital.hospital.dto.HospitalDtos.*;
import com.hospital.hospital.service.AuthService;

import jakarta.validation.Valid;

/** Centralised authentication for the whole platform: login issues the JWT every service trusts. */
@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService auth;

    public AuthController(AuthService auth) {
        this.auth = auth;
    }

    @PostMapping("/login")
    public TokenResponse login(@Valid @RequestBody LoginRequest req) {
        return auth.login(req);
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponse register(@Valid @RequestBody RegisterRequest req) {
        return auth.registerPatientAccount(req);
    }

    @GetMapping("/me")
    public UserResponse me() {
        return auth.me();
    }
}
