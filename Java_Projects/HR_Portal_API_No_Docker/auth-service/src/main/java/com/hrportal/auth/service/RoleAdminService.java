package com.hrportal.auth.service;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hrportal.auth.dto.AuthDtos.PermissionRequest;
import com.hrportal.auth.dto.AuthDtos.PermissionResponse;
import com.hrportal.auth.dto.AuthDtos.RoleRequest;
import com.hrportal.auth.dto.AuthDtos.RoleResponse;
import com.hrportal.auth.entity.Permission;
import com.hrportal.auth.entity.Role;
import com.hrportal.auth.mapper.AuthMapper;
import com.hrportal.auth.repository.PermissionRepository;
import com.hrportal.auth.repository.RoleRepository;
import com.hrportal.common.audit.AuditService;
import com.hrportal.common.exception.BadRequestException;
import com.hrportal.common.exception.ConflictException;
import com.hrportal.common.exception.ResourceNotFoundException;

/** Role and permission management. The seven built-in roles cannot be deleted or renamed (no such endpoint exists). */
@Service
public class RoleAdminService {
    private final RoleRepository roles;
    private final PermissionRepository permissions;
    private final AuditService audit;
    private final AuthMapper mapper;

    public RoleAdminService(RoleRepository roles, PermissionRepository permissions, AuditService audit, AuthMapper mapper) {
        this.roles = roles;
        this.permissions = permissions;
        this.audit = audit;
        this.mapper = mapper;
    }

    @Transactional(readOnly = true)
    public List<RoleResponse> listRoles() {
        return roles.findAllByOrderByNameAsc().stream().map(mapper::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<PermissionResponse> listPermissions() {
        return permissions.findAllByOrderByCodeAsc().stream().map(mapper::toResponse).toList();
    }

    @Transactional
    public RoleResponse createRole(RoleRequest req) {
        if (roles.findByName(req.name()).isPresent()) throw new ConflictException("Role already exists: " + req.name());
        Role r = new Role();
        r.setName(req.name());
        r.setDescription(req.description());
        r.setPermissions(resolve(req.permissions()));
        r = roles.save(r);
        audit.record("Role", r.getId(), "ROLE_CREATED", mapper.toResponse(r));
        return mapper.toResponse(r);
    }

    @Transactional
    public RoleResponse setPermissions(String roleId, Set<String> codes) {
        Role r = roles.findById(roleId).orElseThrow(() -> ResourceNotFoundException.of("Role", roleId));
        Object before = mapper.toResponse(r);
        r.setPermissions(resolve(codes));
        r = roles.save(r);
        audit.record("Role", r.getId(), "ROLE_PERMISSIONS_CHANGED", before, mapper.toResponse(r));
        return mapper.toResponse(r);
    }

    @Transactional
    public PermissionResponse createPermission(PermissionRequest req) {
        if (permissions.findByCode(req.code()).isPresent()) throw new ConflictException("Permission already exists: " + req.code());
        Permission p = new Permission();
        p.setCode(req.code());
        p.setDescription(req.description());
        p = permissions.save(p);
        audit.record("Permission", p.getId(), "PERMISSION_CREATED", mapper.toResponse(p));
        return mapper.toResponse(p);
    }

    private Set<Permission> resolve(Set<String> codes) {
        if (codes == null || codes.isEmpty()) return new HashSet<>();
        List<Permission> found = permissions.findByCodeIn(codes);
        if (found.size() != codes.size()) {
            Set<String> missing = new HashSet<>(codes);
            found.forEach(p -> missing.remove(p.getCode()));
            throw new BadRequestException("Unknown permission(s): " + missing);
        }
        return new HashSet<>(found);
    }
}
