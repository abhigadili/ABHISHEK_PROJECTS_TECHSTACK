package com.hospital.hospital.service;

import java.time.Instant;
import java.util.List;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hospital.common.security.CurrentUser;
import com.hospital.common.security.Role;
import com.hospital.common.web.BadRequestException;
import com.hospital.common.web.ConflictException;
import com.hospital.common.web.ResourceNotFoundException;
import com.hospital.hospital.domain.UserAccount;
import com.hospital.hospital.domain.UserAccountRepository;
import com.hospital.hospital.dto.HospitalDtos.*;

import lombok.extern.log4j.Log4j2;

@Log4j2
@Service
public class AuthService {
    private final UserAccountRepository users;
    private final PasswordEncoder encoder;
    private final JwtTokenService tokens;

    public AuthService(UserAccountRepository users, PasswordEncoder encoder, JwtTokenService tokens) {
        this.users = users;
        this.encoder = encoder;
        this.tokens = tokens;
    }

    @Transactional
    public TokenResponse login(LoginRequest req) {
        UserAccount u = users.findByUsername(req.getUsername()).orElse(null);
        // identical answer for unknown user / wrong password / disabled account: no user enumeration
        if (u == null || !u.isEnabled() || !encoder.matches(req.getPassword(), u.getPasswordHash())) {
            log.warn("Failed login for username '{}'", req.getUsername());
            throw new BadCredentials();
        }
        u.setLastLoginAt(Instant.now());
        log.info("User '{}' ({}) logged in", u.getUsername(), u.getRole());
        return new TokenResponse(tokens.issue(u), "Bearer", tokens.ttlSeconds(), UserResponse.from(u));
    }

    /** Public self-service sign-up - always creates a PATIENT account. */
    @Transactional
    public UserResponse registerPatientAccount(RegisterRequest req) {
        return create(req.getUsername(), req.getEmail(), req.getPassword(), Role.PATIENT);
    }

    @Transactional
    public UserResponse createUser(CreateUserRequest req) {
        return create(req.getUsername(), req.getEmail(), req.getPassword(), req.getRole());
    }

    private UserResponse create(String username, String email, String password, Role role) {
        if (users.existsByUsername(username)) throw new ConflictException("Username '" + username + "' is already taken");
        if (users.existsByEmail(email)) throw new ConflictException("Email '" + email + "' is already registered");
        UserAccount u = new UserAccount();
        u.setUsername(username);
        u.setEmail(email.toLowerCase());
        u.setPasswordHash(encoder.encode(password));
        u.setRole(role);
        try {
            u = users.saveAndFlush(u);
        } catch (DataIntegrityViolationException e) {
            throw new ConflictException("Username or email already exists");
        }
        log.info("Created user '{}' with role {}", username, role);
        return UserResponse.from(u);
    }

    @Transactional(readOnly = true)
    public UserResponse me() {
        Long id = CurrentUser.id();
        return users.findById(id == null ? -1L : id).map(UserResponse::from)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    @Transactional(readOnly = true)
    public List<UserResponse> list() {
        return users.findAll().stream().map(UserResponse::from).toList();
    }

    @Transactional
    public UserResponse setEnabled(Long id, boolean enabled) {
        UserAccount u = users.findById(id).orElseThrow(() -> new ResourceNotFoundException("User " + id + " not found"));
        if (!enabled && id.equals(CurrentUser.id())) throw new BadRequestException("You cannot disable your own account");
        u.setEnabled(enabled);
        return UserResponse.from(u);
    }

    /** Maps to 401 through the shared handler chain. */
    public static class BadCredentials extends com.hospital.common.web.ApiException {
        public BadCredentials() {
            super(org.springframework.http.HttpStatus.UNAUTHORIZED, "Invalid username or password");
        }
    }
}
