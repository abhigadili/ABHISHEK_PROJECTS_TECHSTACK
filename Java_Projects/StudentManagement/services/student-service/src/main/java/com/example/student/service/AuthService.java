package com.example.student.service;

import com.example.common.exception.ConflictException;
import com.example.common.exception.UnauthorizedException;
import com.example.common.security.AuthenticatedUser;
import com.example.common.security.JwtTokenService;
import com.example.student.dto.AuthDtos.*;
import com.example.student.dto.StudentRequest;
import com.example.student.dto.StudentResponse;
import com.example.student.entity.RefreshToken;
import com.example.student.entity.Role;
import com.example.student.entity.UserAccount;
import com.example.student.repository.RefreshTokenRepository;
import com.example.student.repository.UserAccountRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Authentication owner: users + refresh tokens live in StudentDB (see Documentation/17-Spring-Security-and-JWT.md). */
@Service
public class AuthService {
    private static final Logger log = LoggerFactory.getLogger(AuthService.class);
    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserAccountRepository users;
    private final RefreshTokenRepository refreshTokens;
    private final PasswordEncoder encoder;
    private final JwtTokenService jwt;
    private final StudentService students;

    public AuthService(UserAccountRepository users, RefreshTokenRepository refreshTokens, PasswordEncoder encoder,
                       JwtTokenService jwt, StudentService students) {
        this.users = users; this.refreshTokens = refreshTokens; this.encoder = encoder; this.jwt = jwt; this.students = students;
    }

    /** Public registration creates STUDENT accounts (+ student profile). Only an ADMIN caller may create other roles. */
    @Transactional
    public UserResponse register(RegisterRequest r, AuthenticatedUser caller) {
        Role role = r.role() == null ? Role.STUDENT : r.role();
        if (role != Role.STUDENT && (caller == null || !caller.hasRole("ADMIN"))) {
            throw new AccessDeniedException("Only an ADMIN can create " + role + " accounts");
        }
        if (users.existsByUsernameIgnoreCase(r.username())) throw new ConflictException("Username already taken");
        if (users.existsByEmailIgnoreCase(r.email())) throw new ConflictException("Email already registered");

        Long studentId = null;
        if (role == Role.STUDENT) {
            if (r.firstName() == null || r.firstName().isBlank() || r.lastName() == null || r.lastName().isBlank()) {
                throw new IllegalArgumentException("firstName and lastName are required for STUDENT registration");
            }
            StudentResponse s = students.create(new StudentRequest(r.firstName(), r.lastName(), r.email(), r.phoneNumber(),
                    null, null, null, null, null));
            studentId = s.studentId();
        }
        UserAccount u = new UserAccount();
        u.setUsername(r.username());
        u.setEmail(r.email().trim().toLowerCase());
        u.setPasswordHash(encoder.encode(r.password()));
        u.setRole(role);
        u.setStudentId(studentId);
        u = users.save(u);
        log.info("Registered user id={} role={}", u.getUserId(), role);
        return toResponse(u);
    }

    @Transactional
    public TokenResponse login(LoginRequest r) {
        UserAccount u = users.findByUsernameIgnoreCase(r.username()).or(() -> users.findByEmailIgnoreCase(r.username()))
                .orElseThrow(() -> new UnauthorizedException("Invalid username or password"));
        if (!u.isEnabled() || !encoder.matches(r.password(), u.getPasswordHash())) {
            log.warn("Failed login for '{}'", r.username());
            throw new UnauthorizedException("Invalid username or password");
        }
        return issue(u);
    }

    /** Refresh-token rotation: the presented token is revoked and a new pair is issued. */
    @Transactional
    public TokenResponse refresh(String rawToken) {
        RefreshToken t = refreshTokens.findByTokenHash(hash(rawToken)).orElseThrow(() -> new UnauthorizedException("Invalid refresh token"));
        if (t.isRevoked() || t.getExpiresAt().isBefore(LocalDateTime.now())) throw new UnauthorizedException("Refresh token expired or revoked");
        t.setRevoked(true);
        UserAccount u = users.findById(t.getUserId()).filter(UserAccount::isEnabled)
                .orElseThrow(() -> new UnauthorizedException("User no longer active"));
        return issue(u);
    }

    @Transactional
    public void logout(String rawToken) {
        refreshTokens.findByTokenHash(hash(rawToken)).ifPresent(t -> t.setRevoked(true));
    }

    @Transactional(readOnly = true)
    public UserResponse me(AuthenticatedUser caller) {
        return toResponse(users.findById(caller.userId()).orElseThrow(() -> new UnauthorizedException("Unknown user")));
    }

    private TokenResponse issue(UserAccount u) {
        String access = jwt.createAccessToken(u.getUserId(), u.getUsername(), List.of(u.getRole().name()), u.getStudentId());
        byte[] bytes = new byte[48];
        RANDOM.nextBytes(bytes);
        String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        RefreshToken t = new RefreshToken();
        t.setUserId(u.getUserId());
        t.setTokenHash(hash(raw));
        t.setExpiresAt(LocalDateTime.now().plus(jwt.refreshTtl()));
        refreshTokens.save(t);
        return new TokenResponse(access, raw, "Bearer", jwt.accessTtl().toSeconds(), u.getUsername(), u.getRole(), u.getStudentId());
    }

    static String hash(String raw) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private UserResponse toResponse(UserAccount u) {
        return new UserResponse(u.getUserId(), u.getUsername(), u.getEmail(), u.getRole(), u.getStudentId());
    }
}
