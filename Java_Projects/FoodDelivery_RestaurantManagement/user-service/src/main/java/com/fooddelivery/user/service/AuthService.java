package com.fooddelivery.user.service;

import com.fooddelivery.common.aop.Audited;
import com.fooddelivery.common.exception.BadRequestException;
import com.fooddelivery.common.exception.BusinessException;
import com.fooddelivery.common.exception.ConflictException;
import com.fooddelivery.common.security.JwtService;
import com.fooddelivery.common.security.RevokedTokenStore;
import com.fooddelivery.common.security.SecurityUtils;
import com.fooddelivery.user.domain.*;
import com.fooddelivery.user.event.UserEventProducer;
import com.fooddelivery.user.repository.PasswordResetTokenRepository;
import com.fooddelivery.user.repository.RefreshTokenRepository;
import com.fooddelivery.user.repository.UserRepository;
import com.fooddelivery.user.web.Dtos;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.EnumSet;
import java.util.HexFormat;
import java.util.Set;

@Service
public class AuthService {
    private static final Logger log = LoggerFactory.getLogger(AuthService.class);
    private static final Set<Role> SELF_REGISTER = EnumSet.of(Role.CUSTOMER, Role.RESTAURANT_OWNER, Role.DELIVERY_PARTNER);
    private final UserRepository users;
    private final RefreshTokenRepository refreshTokens;
    private final PasswordResetTokenRepository resetTokens;
    private final PasswordEncoder encoder;
    private final AuthenticationManager authManager;
    private final JwtService jwt;
    private final RevokedTokenStore revoked;
    private final UserEventProducer events;
    private final boolean exposeResetToken;
    private final SecureRandom random = new SecureRandom();

    public AuthService(UserRepository users, RefreshTokenRepository refreshTokens, PasswordResetTokenRepository resetTokens,
                       PasswordEncoder encoder, AuthenticationManager authManager, JwtService jwt, RevokedTokenStore revoked,
                       UserEventProducer events, @Value("${food.auth.expose-reset-token:false}") boolean exposeResetToken) {
        this.users = users;
        this.refreshTokens = refreshTokens;
        this.resetTokens = resetTokens;
        this.encoder = encoder;
        this.authManager = authManager;
        this.jwt = jwt;
        this.revoked = revoked;
        this.events = events;
        this.exposeResetToken = exposeResetToken;
    }

    @Audited("USER_REGISTER")
    @Transactional
    public Dtos.UserDto register(Dtos.RegisterRequest r) {
        if (!SELF_REGISTER.contains(r.role())) throw new BadRequestException("ROLE_NOT_ALLOWED", "This role cannot be self-registered");
        if (users.existsByUsernameIgnoreCase(r.username())) throw new ConflictException("Username already taken");
        if (users.existsByEmailIgnoreCase(r.email())) throw new ConflictException("Email already registered");
        User u = new User();
        u.setUsername(r.username().trim());
        u.setEmail(r.email().trim().toLowerCase());
        u.setPasswordHash(encoder.encode(r.password()));
        u.setFullName(r.fullName().trim());
        u.setPhone(r.phone());
        u.getRoles().add(r.role());
        users.save(u);
        events.userRegistered(u, r.role().name());       // outbox row, same transaction
        log.info("User registered id={} role={}", u.getId(), r.role());
        return Dtos.UserDto.from(u);
    }

    @Transactional
    public Dtos.AuthResponse login(Dtos.LoginRequest r) {
        try {
            authManager.authenticate(new UsernamePasswordAuthenticationToken(r.usernameOrEmail().trim(), r.password()));
        } catch (DisabledException e) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "ACCOUNT_DISABLED", "This account is not active");
        } catch (org.springframework.security.core.AuthenticationException e) {
            log.warn("Failed login attempt for '{}'", r.usernameOrEmail().replaceAll("[\r\n]", ""));
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "Invalid username or password");
        }
        User u = users.findByUsernameIgnoreCaseOrEmailIgnoreCase(r.usernameOrEmail().trim(), r.usernameOrEmail().trim()).orElseThrow();
        u.setLastLoginAt(Instant.now());
        log.info("User logged in id={}", u.getId());
        return issue(u);
    }

    @Transactional
    public Dtos.AuthResponse refresh(String refreshToken) {
        Claims c;
        try { c = jwt.parse(refreshToken); } catch (JwtException | IllegalArgumentException e) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "TOKEN_INVALID", "Refresh token is invalid or expired");
        }
        if (!JwtService.TYPE_REFRESH.equals(c.get("typ", String.class))) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "TOKEN_INVALID", "Not a refresh token");
        }
        RefreshToken stored = refreshTokens.findByTokenHash(sha256(refreshToken))
                .orElseThrow(() -> new BusinessException(HttpStatus.UNAUTHORIZED, "TOKEN_INVALID", "Unknown refresh token"));
        if (stored.isRevoked()) {
            // reuse of a rotated token = possible theft -> kill every session of this user
            refreshTokens.revokeAllForUser(stored.getUserId());
            log.warn("Refresh-token reuse detected for user {}; all sessions revoked", stored.getUserId());
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "TOKEN_REUSED", "Refresh token was already used");
        }
        stored.setRevoked(true);
        User u = users.findById(stored.getUserId()).orElseThrow();
        if (u.getStatus() != UserStatus.ACTIVE) throw new BusinessException(HttpStatus.FORBIDDEN, "ACCOUNT_DISABLED", "This account is not active");
        return issue(u);
    }

    @Transactional
    public void logout(String refreshToken) {
        var me = SecurityUtils.requireUser();
        if (refreshToken != null && !refreshToken.isBlank()) {
            refreshTokens.findByTokenHash(sha256(refreshToken)).ifPresent(t -> t.setRevoked(true));
        }
        revoked.revoke(me.tokenId(), jwt.properties().accessTtl());   // access token dies immediately everywhere
        log.info("User logged out id={}", me.userId());
    }

    @Transactional
    public Dtos.MessageResponse forgotPassword(String email) {
        String devToken = null;
        var found = users.findByEmailIgnoreCase(email.trim());
        if (found.isPresent()) {
            User u = found.get();
            byte[] raw = new byte[32];
            random.nextBytes(raw);
            String token = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
            PasswordResetToken t = new PasswordResetToken();
            t.setUserId(u.getId());
            t.setTokenHash(sha256(token));
            t.setExpiresAt(Instant.now().plus(Duration.ofMinutes(30)));
            resetTokens.save(t);
            events.passwordResetRequested(u, token);
            if (exposeResetToken) devToken = token;
            log.info("Password reset requested for user id={}", u.getId());
        }
        // same answer whether or not the e-mail exists (no account enumeration)
        return new Dtos.MessageResponse("If that e-mail is registered, a reset code has been sent.", devToken);
    }

    @Transactional
    public void resetPassword(Dtos.ResetPasswordRequest r) {
        PasswordResetToken t = resetTokens.findByTokenHash(sha256(r.token()))
                .orElseThrow(() -> new BadRequestException("RESET_TOKEN_INVALID", "Reset code is invalid"));
        if (t.isUsed() || t.getExpiresAt().isBefore(Instant.now())) throw new BadRequestException("RESET_TOKEN_INVALID", "Reset code is invalid or expired");
        User u = users.findById(t.getUserId()).orElseThrow();
        u.setPasswordHash(encoder.encode(r.newPassword()));
        t.setUsed(true);
        refreshTokens.revokeAllForUser(u.getId());
        log.info("Password reset completed for user id={}", u.getId());
    }

    @Transactional
    public void changePassword(Dtos.ChangePasswordRequest r) {
        User u = users.findById(SecurityUtils.requireUser().userId()).orElseThrow();
        if (!encoder.matches(r.currentPassword(), u.getPasswordHash())) throw new BadRequestException("PASSWORD_MISMATCH", "Current password is incorrect");
        u.setPasswordHash(encoder.encode(r.newPassword()));
        refreshTokens.revokeAllForUser(u.getId());
        log.info("Password changed for user id={}", u.getId());
    }

    private Dtos.AuthResponse issue(User u) {
        var roles = u.getRoles().stream().map(Enum::name).sorted().toList();
        String access = jwt.issueAccessToken(u.getId(), u.getUsername(), roles, Permission.names(u.getRoles()));
        String refresh = jwt.issueRefreshToken(u.getId(), u.getUsername());
        RefreshToken rt = new RefreshToken();
        rt.setUserId(u.getId());
        rt.setTokenHash(sha256(refresh));
        rt.setExpiresAt(Instant.now().plus(jwt.properties().refreshTtl()));
        refreshTokens.save(rt);
        return new Dtos.AuthResponse(access, refresh, "Bearer", jwt.properties().accessTtl().toSeconds(), Dtos.UserDto.from(u));
    }

    static String sha256(String s) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8))); }
        catch (NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
}
