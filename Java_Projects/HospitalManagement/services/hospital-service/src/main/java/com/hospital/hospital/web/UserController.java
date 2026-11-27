package com.hospital.hospital.web;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import com.hospital.hospital.dto.HospitalDtos.*;
import com.hospital.hospital.service.AuthService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/users")
@PreAuthorize("hasRole('ADMIN')")
public class UserController {
    private final AuthService auth;

    public UserController(AuthService auth) {
        this.auth = auth;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponse create(@Valid @RequestBody CreateUserRequest req) {
        return auth.createUser(req);
    }

    @GetMapping
    public List<UserResponse> list() {
        return auth.list();
    }

    @PatchMapping("/{id}/enabled")
    public UserResponse enabled(@PathVariable Long id, @Valid @RequestBody EnabledRequest req) {
        return auth.setEnabled(id, req.getEnabled());
    }
}
