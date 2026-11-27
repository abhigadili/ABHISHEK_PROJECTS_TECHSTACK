package com.hrportal.auth.service;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hrportal.auth.dto.AuthDtos.AdminResetPasswordRequest;
import com.hrportal.auth.dto.AuthDtos.RegisterUserRequest;
import com.hrportal.auth.dto.AuthDtos.UserResponse;
import com.hrportal.auth.entity.AccountStatus;
import com.hrportal.auth.entity.Role;
import com.hrportal.auth.entity.UserAccount;
import com.hrportal.auth.mapper.AuthMapper;
import com.hrportal.auth.repository.RefreshTokenRepository;
import com.hrportal.auth.repository.RoleRepository;
import com.hrportal.auth.repository.UserAccountRepository;
import com.hrportal.common.audit.AuditService;
import com.hrportal.common.events.HrEvents.NotificationRequested;
import com.hrportal.common.events.Topics;
import com.hrportal.common.exception.BadRequestException;
import com.hrportal.common.exception.ConflictException;
import com.hrportal.common.exception.ForbiddenOperationException;
import com.hrportal.common.exception.ResourceNotFoundException;
import com.hrportal.common.kafka.EventPublisher;
import com.hrportal.common.security.CurrentUser;

/** User provisioning and administration (registration, role assignment, activation, unlock, employee mapping). */
@Service
public class UserAdminService {
    private static final Logger log = LoggerFactory.getLogger(UserAdminService.class);
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

    private final UserAccountRepository users;
    private final RoleRepository roles;
    private final RefreshTokenRepository refreshTokens;
    private final PasswordEncoder encoder;
    private final SessionRegistry sessions;
    private final LoginAttemptService attempts;
    private final AuditService audit;
    private final EventPublisher events;
    private final AuthMapper mapper;

    public UserAdminService(UserAccountRepository users, RoleRepository roles, RefreshTokenRepository refreshTokens,
                            PasswordEncoder encoder, SessionRegistry sessions, LoginAttemptService attempts,
                            AuditService audit, EventPublisher events, AuthMapper mapper) {
        this.users = users;
        this.roles = roles;
        this.refreshTokens = refreshTokens;
        this.encoder = encoder;
        this.sessions = sessions;
        this.attempts = attempts;
        this.audit = audit;
        this.events = events;
        this.mapper = mapper;
    }

    @Transactional
    public UserResponse register(RegisterUserRequest req) {
        if (users.existsByUsernameIgnoreCase(req.username())) throw new ConflictException("Username already exists");
        if (users.existsByEmailIgnoreCase(req.email())) throw new ConflictException("E-mail already registered");
        if (req.employeeId() != null && users.findByEmployeeId(req.employeeId()).isPresent()) {
            throw new ConflictException("Employee already has a user account");
        }
        Set<Role> assigned = resolveRoles(req.roles());
        UserAccount u = new UserAccount();
        u.setUsername(req.username());
        u.setEmail(req.email().toLowerCase());
        u.setPasswordHash(encoder.encode(req.password()));
        u.setEmployeeId(req.employeeId());
        u.setMustChangePassword(req.mustChangePassword() == null || req.mustChangePassword());
        u.setPasswordChangedAt(Instant.now());
        u.setRoles(assigned);
        u = users.save(u);
        audit.record("UserAccount", u.getId(), "USER_REGISTERED", Map.of("username", u.getUsername(), "roles", names(assigned)));
        return mapper.toResponse(u);
    }

    /** Called by the employee.created consumer: one EMPLOYEE account per employee, random password, must reset on first use. */
    @Transactional
    public void provisionForEmployee(String employeeId, String employeeCode, String email, String firstName) {
        if (users.findByEmployeeId(employeeId).isPresent() || users.existsByEmailIgnoreCase(email)) {
            log.info("Account for employee {} already exists - skipping provisioning", employeeId);
            return;
        }
        String username = employeeCode.toLowerCase();
        if (users.existsByUsernameIgnoreCase(username)) username = username + "." + employeeId.substring(0, 4);
        UserAccount u = new UserAccount();
        u.setUsername(username);
        u.setEmail(email.toLowerCase());
        u.setPasswordHash(encoder.encode(randomPassword()));
        u.setEmployeeId(employeeId);
        u.setMustChangePassword(true);
        u.setPasswordChangedAt(Instant.now());
        u.setRoles(resolveRoles(Set.of("EMPLOYEE")));
        u = users.save(u);
        audit.record("UserAccount", u.getId(), "USER_PROVISIONED", Map.of("employeeId", employeeId, "username", u.getUsername()));
        events.publish(Topics.NOTIFICATION_REQUESTED, employeeId, NotificationRequested.of(employeeId, u.getEmail(), "ACCOUNT_PROVISIONED",
                "ACCOUNT_PROVISIONED", Map.of("name", firstName, "username", u.getUsername()), "USER", u.getId(), "provision:" + employeeId));
        log.info("Provisioned user {} for employee {}", u.getUsername(), employeeId);
    }

    @Transactional
    public void deactivateByEmployee(String employeeId, String reason) {
        users.findByEmployeeId(employeeId).ifPresent(u -> {
            u.setStatus(AccountStatus.INACTIVE);
            users.save(u);
            refreshTokens.revokeAllForUser(u.getId(), Instant.now());
            int revoked = sessions.revokeAll(u.getId());
            audit.record("UserAccount", u.getId(), "USER_DEACTIVATED", Map.of("reason", reason, "tokensRevoked", revoked));
        });
    }

    @Transactional(readOnly = true)
    public Page<UserResponse> search(String q, String status, Pageable pageable) {
        AccountStatus s = status == null || status.isBlank() ? null : parseStatus(status);
        Page<UserAccount> page = users.search(q == null || q.isBlank() ? null : q.trim(), s, pageable);
        // one extra query loads roles + permissions for the whole page (no N+1)
        java.util.Map<String, UserAccount> byId = new java.util.HashMap<>();
        users.findByIdIn(page.getContent().stream().map(UserAccount::getId).toList()).forEach(u -> byId.put(u.getId(), u));
        return page.map(u -> mapper.toResponse(byId.get(u.getId())));
    }

    @Transactional(readOnly = true)
    public UserResponse get(String id) {
        return mapper.toResponse(withRoles(id));
    }

    @Transactional(readOnly = true)
    public UserResponse getByEmployee(String employeeId) {
        return mapper.toResponse(users.findByEmployeeId(employeeId).orElseThrow(() -> ResourceNotFoundException.of("User for employee", employeeId)));
    }

    @Transactional
    public UserResponse assignRoles(String id, Set<String> roleNames) {
        UserAccount u = withRoles(id);
        Set<Role> newRoles = resolveRoles(roleNames);
        Set<String> before = names(u.getRoles());
        u.setRoles(new HashSet<>(newRoles));
        users.save(u);
        sessions.revokeAll(u.getId());   // roles live in the token: force a fresh login so changes apply immediately
        audit.record("UserAccount", u.getId(), "ROLES_CHANGED", before, names(newRoles));
        return mapper.toResponse(u);
    }

    @Transactional
    public UserResponse changeStatus(String id, String status) {
        UserAccount u = withRoles(id);
        AccountStatus target = parseStatus(status);
        if (u.getId().equals(CurrentUser.userId()) && target == AccountStatus.INACTIVE) throw new BadRequestException("You cannot deactivate your own account");
        AccountStatus before = u.getStatus();
        u.setStatus(target);
        if (target == AccountStatus.ACTIVE) {
            u.setFailedAttempts(0);
            u.setLockedUntil(null);
        } else {
            refreshTokens.revokeAllForUser(u.getId(), Instant.now());
            sessions.revokeAll(u.getId());
        }
        users.save(u);
        audit.record("UserAccount", u.getId(), "STATUS_CHANGED", before.name(), target.name());
        return mapper.toResponse(u);
    }

    @Transactional
    public UserResponse unlock(String id) {
        UserAccount u = withRoles(id);
        u.setStatus(AccountStatus.ACTIVE);
        u.setFailedAttempts(0);
        u.setLockedUntil(null);
        attempts.reset(u.getUsername());
        users.save(u);
        audit.record("UserAccount", u.getId(), "ACCOUNT_UNLOCKED", null);
        return mapper.toResponse(u);
    }

    @Transactional
    public int revokeSessions(String id) {
        UserAccount u = withRoles(id);
        refreshTokens.revokeAllForUser(u.getId(), Instant.now());
        int n = sessions.revokeAll(u.getId());
        audit.record("UserAccount", u.getId(), "SESSIONS_REVOKED", Map.of("accessTokens", n));
        return n;
    }

    @Transactional
    public void adminResetPassword(String id, AdminResetPasswordRequest req) {
        UserAccount u = withRoles(id);
        u.setPasswordHash(encoder.encode(req.newPassword()));
        u.setPasswordChangedAt(Instant.now());
        u.setMustChangePassword(true);
        u.setFailedAttempts(0);
        u.setLockedUntil(null);
        if (u.getStatus() == AccountStatus.LOCKED) u.setStatus(AccountStatus.ACTIVE);
        users.save(u);
        refreshTokens.revokeAllForUser(u.getId(), Instant.now());
        sessions.revokeAll(u.getId());
        audit.record("UserAccount", u.getId(), "PASSWORD_RESET_BY_ADMIN", null);
    }

    @Transactional
    public UserResponse mapEmployee(String id, String employeeId) {
        UserAccount u = withRoles(id);
        users.findByEmployeeId(employeeId).filter(o -> !o.getId().equals(id)).ifPresent(o -> {
            throw new ConflictException("Employee is already mapped to user " + o.getUsername());
        });
        String before = u.getEmployeeId();
        u.setEmployeeId(employeeId);
        users.save(u);
        sessions.revokeAll(u.getId());
        audit.record("UserAccount", u.getId(), "EMPLOYEE_MAPPED", before, employeeId);
        return mapper.toResponse(u);
    }

    private UserAccount withRoles(String id) {
        return users.findWithRolesById(id).orElseThrow(() -> ResourceNotFoundException.of("User", id));
    }

    /** HR admins may hand out every role except SUPER_ADMIN (privilege-escalation guard). */
    private Set<Role> resolveRoles(Set<String> requested) {
        Set<String> upper = new HashSet<>();
        requested.forEach(r -> upper.add(r.trim().toUpperCase()));
        List<Role> found = roles.findByNameIn(upper);
        if (found.size() != upper.size()) {
            Set<String> missing = new HashSet<>(upper);
            found.forEach(r -> missing.remove(r.getName()));
            throw new BadRequestException("Unknown role(s): " + missing);
        }
        if (upper.contains("SUPER_ADMIN") && CurrentUser.get().isPresent() && !CurrentUser.hasRole(com.hrportal.common.security.Role.SUPER_ADMIN)) {
            throw new ForbiddenOperationException("Only a SUPER_ADMIN can grant the SUPER_ADMIN role");
        }
        return new HashSet<>(found);
    }

    private static Set<String> names(Set<Role> rs) {
        Set<String> out = new java.util.TreeSet<>();
        rs.forEach(r -> out.add(r.getName()));
        return out;
    }

    private static AccountStatus parseStatus(String s) {
        try {
            return AccountStatus.valueOf(s.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Unknown status: " + s);
        }
    }

    private static String randomPassword() {
        StringBuilder sb = new StringBuilder("Aa1!");
        for (int i = 0; i < 20; i++) sb.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
        return sb.toString();
    }
}
