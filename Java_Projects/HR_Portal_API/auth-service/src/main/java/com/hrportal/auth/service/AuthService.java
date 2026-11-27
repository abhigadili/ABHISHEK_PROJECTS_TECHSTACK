package com.hrportal.auth.service;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hrportal.auth.dto.AuthDtos.ChangePasswordRequest;
import com.hrportal.auth.dto.AuthDtos.ForgotPasswordRequest;
import com.hrportal.auth.dto.AuthDtos.ForgotPasswordResponse;
import com.hrportal.auth.dto.AuthDtos.LoginRequest;
import com.hrportal.auth.dto.AuthDtos.ResetPasswordRequest;
import com.hrportal.auth.dto.AuthDtos.TokenResponse;
import com.hrportal.auth.dto.AuthDtos.UserResponse;
import com.hrportal.auth.entity.AccountStatus;
import com.hrportal.auth.entity.PasswordResetToken;
import com.hrportal.auth.entity.RefreshToken;
import com.hrportal.auth.entity.UserAccount;
import com.hrportal.auth.mapper.AuthMapper;
import com.hrportal.auth.repository.PasswordResetTokenRepository;
import com.hrportal.auth.repository.RefreshTokenRepository;
import com.hrportal.auth.repository.UserAccountRepository;
import com.hrportal.auth.service.TokenService.AccessToken;
import com.hrportal.auth.service.TokenService.IssuedRefreshToken;
import com.hrportal.common.audit.AuditService;
import com.hrportal.common.events.HrEvents.NotificationRequested;
import com.hrportal.common.events.Topics;
import com.hrportal.common.exception.ApiException;
import com.hrportal.common.exception.BadRequestException;
import com.hrportal.common.exception.UnauthorizedException;
import com.hrportal.common.kafka.EventPublisher;
import com.hrportal.common.security.AuthenticatedUser;
import com.hrportal.common.security.CurrentUser;

/** Login, refresh, logout, password change and the password-reset workflow. */
@Service
public class AuthService {
    private static final Logger log = LoggerFactory.getLogger(AuthService.class);
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String RESET_PREFIX = "hr:auth:reset:";
    private static final Duration RESET_TTL = Duration.ofMinutes(30);

    private final UserAccountRepository users;
    private final RefreshTokenRepository refreshTokens;
    private final PasswordResetTokenRepository resetTokens;
    private final PasswordEncoder encoder;
    private final TokenService tokens;
    private final SessionRegistry sessions;
    private final LoginAttemptService attempts;
    private final StringRedisTemplate redis;
    private final EventPublisher events;
    private final AuditService audit;
    private final AuthMapper mapper;
    private final boolean exposeResetToken;
    private final String dummyHash;

    public AuthService(UserAccountRepository users, RefreshTokenRepository refreshTokens, PasswordResetTokenRepository resetTokens,
                       PasswordEncoder encoder, TokenService tokens, SessionRegistry sessions, LoginAttemptService attempts,
                       StringRedisTemplate redis, EventPublisher events, AuditService audit, AuthMapper mapper,
                       @Value("${hr.auth.expose-reset-token:false}") boolean exposeResetToken) {
        this.users = users;
        this.refreshTokens = refreshTokens;
        this.resetTokens = resetTokens;
        this.encoder = encoder;
        this.tokens = tokens;
        this.sessions = sessions;
        this.attempts = attempts;
        this.redis = redis;
        this.events = events;
        this.audit = audit;
        this.mapper = mapper;
        this.exposeResetToken = exposeResetToken;
        this.dummyHash = encoder.encode("timing-equaliser-not-a-real-password");
    }

    // noRollbackFor: the failed-attempt counter / lock must be committed even though we then throw 401
    @Transactional(noRollbackFor = ApiException.class)
    public TokenResponse login(LoginRequest req, String ip) {
        UserAccount user = users.findByUsernameIgnoreCase(req.username()).orElse(null);
        if (user == null) {
            encoder.matches(req.password(), dummyHash);   // equalise timing: unknown user vs wrong password
            throw new UnauthorizedException("Invalid username or password");
        }
        if (user.getStatus() == AccountStatus.INACTIVE) throw new UnauthorizedException("Account is deactivated");
        if (user.getStatus() == AccountStatus.LOCKED) {
            if (user.getLockedUntil() != null && user.getLockedUntil().isAfter(Instant.now())) {
                throw new UnauthorizedException("Account is temporarily locked after repeated failed logins");
            }
            user.setStatus(AccountStatus.ACTIVE);          // lock expired
            user.setFailedAttempts(0);
            user.setLockedUntil(null);
        }
        if (!encoder.matches(req.password(), user.getPasswordHash())) {
            long failures = attempts.recordFailure(user.getUsername());
            user.setFailedAttempts((int) failures);
            if (attempts.limitReached(failures)) {
                user.setStatus(AccountStatus.LOCKED);
                user.setLockedUntil(Instant.now().plus(attempts.lockDuration()));
                audit.record("UserAccount", user.getId(), "ACCOUNT_LOCKED", Map.of("failedAttempts", failures));
                log.warn("Account locked after {} failed logins for user {}", failures, user.getUsername());
            }
            users.save(user);
            throw new UnauthorizedException("Invalid username or password");
        }
        attempts.reset(user.getUsername());
        user.setFailedAttempts(0);
        user.setLastLoginAt(Instant.now());
        users.save(user);
        audit.record("UserAccount", user.getId(), "LOGIN", Map.of("ip", String.valueOf(ip)));
        return issue(user, ip);
    }

    @Transactional
    public TokenResponse refresh(String refreshValue, String ip) {
        String hash = TokenService.sha256(refreshValue);
        RefreshToken stored = refreshTokens.findByTokenHash(hash).orElseThrow(() -> new UnauthorizedException("Invalid refresh token"));
        if (stored.getRevokedAt() != null || stored.getExpiresAt().isBefore(Instant.now())
                || !Boolean.TRUE.equals(redis.hasKey(TokenService.REFRESH_PREFIX + hash))) {
            throw new UnauthorizedException("Refresh token expired or revoked");
        }
        UserAccount user = users.findWithRolesById(stored.getUserId()).orElseThrow(() -> new UnauthorizedException("Unknown user"));
        if (user.getStatus() != AccountStatus.ACTIVE) throw new UnauthorizedException("Account is not active");
        tokens.revoke(stored);                      // rotation: a refresh token can be used only once
        return issue(user, ip);
    }

    @Transactional
    public void logout(AuthenticatedUser caller, String refreshValue) {
        if (refreshValue != null && !refreshValue.isBlank()) {
            refreshTokens.findByTokenHash(TokenService.sha256(refreshValue))
                    .filter(t -> t.getUserId().equals(caller.userId()) && t.getRevokedAt() == null)
                    .ifPresent(tokens::revoke);
        }
        // blacklist the presented access token until it would have expired anyway
        sessions.revokeToken(caller.tokenId(), Instant.now().plus(Duration.ofMinutes(60)));
        sessions.remove(caller.userId(), caller.tokenId());
        audit.record("UserAccount", caller.userId(), "LOGOUT", Map.of("jti", String.valueOf(caller.tokenId())));
    }

    @Transactional(readOnly = true)
    public UserResponse me() {
        AuthenticatedUser caller = CurrentUser.require();
        return mapper.toResponse(users.findWithRolesById(caller.userId()).orElseThrow(() -> new UnauthorizedException("Unknown user")));
    }

    @Transactional
    public void changePassword(ChangePasswordRequest req) {
        AuthenticatedUser caller = CurrentUser.require();
        UserAccount user = users.findById(caller.userId()).orElseThrow(() -> new UnauthorizedException("Unknown user"));
        if (!encoder.matches(req.currentPassword(), user.getPasswordHash())) throw new BadRequestException("Current password is incorrect");
        if (encoder.matches(req.newPassword(), user.getPasswordHash())) throw new BadRequestException("New password must differ from the current one");
        applyNewPassword(user);
        user.setPasswordHash(encoder.encode(req.newPassword()));
        users.save(user);
        sessions.revokeToken(caller.tokenId(), Instant.now().plus(Duration.ofMinutes(60)));
        audit.record("UserAccount", user.getId(), "PASSWORD_CHANGED", null);
    }

    @Transactional
    public ForgotPasswordResponse forgotPassword(ForgotPasswordRequest req) {
        String generic = "If the e-mail address is registered, a password-reset link has been sent";
        UserAccount user = users.findByEmailIgnoreCase(req.email()).orElse(null);
        if (user == null || user.getStatus() == AccountStatus.INACTIVE) return new ForgotPasswordResponse(generic, null);
        byte[] raw = new byte[32];
        RANDOM.nextBytes(raw);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
        String hash = TokenService.sha256(token);
        PasswordResetToken entity = new PasswordResetToken();
        entity.setUserId(user.getId());
        entity.setTokenHash(hash);
        entity.setExpiresAt(Instant.now().plus(RESET_TTL));
        resetTokens.save(entity);
        redis.opsForValue().set(RESET_PREFIX + hash, user.getId(), RESET_TTL);   // temporary verification token
        events.publish(Topics.NOTIFICATION_REQUESTED, user.getId(), NotificationRequested.of(user.getEmployeeId(), user.getEmail(),
                "PASSWORD_RESET", "PASSWORD_RESET", Map.of("name", user.getUsername(), "token", token, "expiresMinutes", "30"),
                "USER", user.getId(), "pwreset:" + hash.substring(0, 12)));
        audit.record("UserAccount", user.getId(), "PASSWORD_RESET_REQUESTED", null);
        return new ForgotPasswordResponse(generic, exposeResetToken ? token : null);
    }

    @Transactional
    public void resetPassword(ResetPasswordRequest req) {
        String hash = TokenService.sha256(req.token());
        PasswordResetToken entity = resetTokens.findByTokenHash(hash).orElseThrow(() -> new BadRequestException("Invalid or expired reset token"));
        if (entity.getUsedAt() != null || entity.getExpiresAt().isBefore(Instant.now())
                || !Boolean.TRUE.equals(redis.hasKey(RESET_PREFIX + hash))) {
            throw new BadRequestException("Invalid or expired reset token");
        }
        UserAccount user = users.findById(entity.getUserId()).orElseThrow(() -> new BadRequestException("Invalid or expired reset token"));
        user.setPasswordHash(encoder.encode(req.newPassword()));
        applyNewPassword(user);
        if (user.getStatus() == AccountStatus.LOCKED) user.setStatus(AccountStatus.ACTIVE);
        user.setLockedUntil(null);
        users.save(user);
        entity.setUsedAt(Instant.now());
        redis.delete(RESET_PREFIX + hash);
        attempts.reset(user.getUsername());
        audit.record("UserAccount", user.getId(), "PASSWORD_RESET_COMPLETED", null);
    }

    /** Shared bookkeeping for any password change: stamp it, clear the must-change flag, kill all sessions. */
    void applyNewPassword(UserAccount user) {
        user.setPasswordChangedAt(Instant.now());
        user.setMustChangePassword(false);
        user.setFailedAttempts(0);
        refreshTokens.revokeAllForUser(user.getId(), Instant.now());
        sessions.revokeAll(user.getId());
    }

    private TokenResponse issue(UserAccount user, String ip) {
        AccessToken access = tokens.issueAccessToken(user);
        IssuedRefreshToken refresh = tokens.issueRefreshToken(user, access.jti(), ip);
        sessions.register(user.getId(), access.jti(), access.expiresAt());
        return new TokenResponse(access.value(), refresh.value(), "Bearer", tokens.accessTokenSeconds(),
                user.isMustChangePassword(), mapper.toResponse(user));
    }
}
