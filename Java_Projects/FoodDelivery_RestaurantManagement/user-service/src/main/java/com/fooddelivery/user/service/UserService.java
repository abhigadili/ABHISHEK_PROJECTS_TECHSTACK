package com.fooddelivery.user.service;

import com.fooddelivery.common.aop.Audited;
import com.fooddelivery.common.exception.ConflictException;
import com.fooddelivery.common.exception.NotFoundException;
import com.fooddelivery.common.security.SecurityUtils;
import com.fooddelivery.user.domain.Role;
import com.fooddelivery.user.domain.User;
import com.fooddelivery.user.domain.UserStatus;
import com.fooddelivery.user.repository.RefreshTokenRepository;
import com.fooddelivery.user.repository.UserRepository;
import com.fooddelivery.user.web.Dtos;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;

@Service
public class UserService {
    private final UserRepository users;
    private final RefreshTokenRepository refreshTokens;
    private final PasswordEncoder encoder;

    public UserService(UserRepository users, RefreshTokenRepository refreshTokens, PasswordEncoder encoder) {
        this.users = users;
        this.refreshTokens = refreshTokens;
        this.encoder = encoder;
    }

    @Transactional(readOnly = true)
    public Dtos.UserDto me() { return Dtos.UserDto.from(find(SecurityUtils.requireUser().userId())); }

    @Transactional
    public Dtos.UserDto updateMe(Dtos.UpdateProfileRequest r) {
        User u = find(SecurityUtils.requireUser().userId());
        u.setFullName(r.fullName().trim());
        u.setPhone(r.phone());
        return Dtos.UserDto.from(u);
    }

    @Transactional(readOnly = true)
    public Dtos.UserDto get(Long id) { return Dtos.UserDto.from(find(id)); }

    @Transactional(readOnly = true)
    public Dtos.ContactDto contact(Long id) { return Dtos.ContactDto.from(find(id)); }

    /** Criteria-API Specification: optional role / status / free-text filters + pagination. */
    @Transactional(readOnly = true)
    public Page<Dtos.UserDto> search(Role role, UserStatus status, String q, Pageable pageable) {
        Specification<User> spec = (root, query, cb) -> {
            List<Predicate> p = new ArrayList<>();
            if (role != null) p.add(cb.isMember(role, root.get("roles")));
            if (status != null) p.add(cb.equal(root.get("status"), status));
            if (q != null && !q.isBlank()) {
                String like = "%" + q.trim().toLowerCase() + "%";
                p.add(cb.or(cb.like(cb.lower(root.get("username")), like), cb.like(cb.lower(root.get("email")), like),
                        cb.like(cb.lower(root.get("fullName")), like)));
            }
            return cb.and(p.toArray(Predicate[]::new));
        };
        return users.findAll(spec, pageable).map(Dtos.UserDto::from);
    }

    @Audited("USER_STATUS_CHANGE")
    @Transactional
    public Dtos.UserDto changeStatus(Long id, UserStatus status) {
        User u = find(id);
        if (u.getId().equals(SecurityUtils.requireUser().userId()) && status != UserStatus.ACTIVE) {
            throw new ConflictException("You cannot deactivate your own account");
        }
        u.setStatus(status);
        if (status != UserStatus.ACTIVE) refreshTokens.revokeAllForUser(id);
        return Dtos.UserDto.from(u);
    }

    @Audited("ADMIN_CREATE")
    @Transactional
    public Dtos.UserDto createAdmin(Dtos.CreateAdminRequest r) {
        if (users.existsByUsernameIgnoreCase(r.username())) throw new ConflictException("Username already taken");
        if (users.existsByEmailIgnoreCase(r.email())) throw new ConflictException("Email already registered");
        User u = new User();
        u.setUsername(r.username().trim());
        u.setEmail(r.email().trim().toLowerCase());
        u.setPasswordHash(encoder.encode(r.password()));
        u.setFullName(r.fullName());
        u.getRoles().add(r.superAdmin() ? Role.SUPER_ADMIN : Role.ADMIN);
        return Dtos.UserDto.from(users.save(u));
    }

    @Transactional(readOnly = true)
    public Map<String, Object> stats() {
        Map<String, Object> m = new java.util.LinkedHashMap<>();
        m.put("total", users.count());
        m.put("active", users.countByStatus(UserStatus.ACTIVE));
        m.put("suspended", users.countByStatus(UserStatus.SUSPENDED));
        for (Role r : EnumSet.allOf(Role.class)) {
            m.put(r.name().toLowerCase(), users.count((root, q, cb) -> cb.isMember(r, root.get("roles"))));
        }
        return m;
    }

    private User find(Long id) { return users.findById(id).orElseThrow(() -> new NotFoundException("User", id)); }
}
