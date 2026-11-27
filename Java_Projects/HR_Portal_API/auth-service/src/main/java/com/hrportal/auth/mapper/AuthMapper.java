package com.hrportal.auth.mapper;

import java.util.Comparator;
import java.util.List;

import org.springframework.stereotype.Component;

import com.hrportal.auth.dto.AuthDtos.PermissionResponse;
import com.hrportal.auth.dto.AuthDtos.RoleResponse;
import com.hrportal.auth.dto.AuthDtos.UserResponse;
import com.hrportal.auth.entity.Permission;
import com.hrportal.auth.entity.Role;
import com.hrportal.auth.entity.UserAccount;

/** Explicit mapping where the DTO shape (flattened role / permission names) differs from the entity graph. */
@Component
public class AuthMapper {

    public UserResponse toResponse(UserAccount u) {
        List<String> roles = u.getRoles().stream().map(Role::getName).sorted().toList();
        List<String> perms = u.getRoles().stream().flatMap(r -> r.getPermissions().stream()).map(Permission::getCode)
                .distinct().sorted().toList();
        return new UserResponse(u.getId(), u.getUsername(), u.getEmail(), u.getEmployeeId(), u.getStatus().name(), roles, perms,
                u.isMustChangePassword(), u.getLastLoginAt(), u.getLockedUntil(), u.getCreatedAt());
    }

    public RoleResponse toResponse(Role r) {
        return new RoleResponse(r.getId(), r.getName(), r.getDescription(),
                r.getPermissions().stream().map(Permission::getCode).sorted(Comparator.naturalOrder()).toList());
    }

    public PermissionResponse toResponse(Permission p) {
        return new PermissionResponse(p.getId(), p.getCode(), p.getDescription());
    }
}
