package com.hrportal.auth.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.hrportal.auth.dto.AuthDtos.PermissionRequest;
import com.hrportal.auth.dto.AuthDtos.PermissionResponse;
import com.hrportal.auth.dto.AuthDtos.RolePermissionsRequest;
import com.hrportal.auth.dto.AuthDtos.RoleRequest;
import com.hrportal.auth.dto.AuthDtos.RoleResponse;
import com.hrportal.auth.service.RoleAdminService;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@Tag(name = "Roles and Permissions")
@RestController
@RequestMapping("/api/v1/auth")
public class RoleController {
    private final RoleAdminService service;

    public RoleController(RoleAdminService service) {
        this.service = service;
    }

    @GetMapping("/roles")
    @PreAuthorize("hasAnyRole('HR_ADMIN','SUPER_ADMIN')")
    public List<RoleResponse> roles() {
        return service.listRoles();
    }

    @PostMapping("/roles")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public RoleResponse createRole(@Valid @RequestBody RoleRequest req) {
        return service.createRole(req);
    }

    @PutMapping("/roles/{id}/permissions")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public RoleResponse setPermissions(@PathVariable String id, @Valid @RequestBody RolePermissionsRequest req) {
        return service.setPermissions(id, req.permissions());
    }

    @GetMapping("/permissions")
    @PreAuthorize("hasAnyRole('HR_ADMIN','SUPER_ADMIN')")
    public List<PermissionResponse> permissions() {
        return service.listPermissions();
    }

    @PostMapping("/permissions")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public PermissionResponse createPermission(@Valid @RequestBody PermissionRequest req) {
        return service.createPermission(req);
    }
}
