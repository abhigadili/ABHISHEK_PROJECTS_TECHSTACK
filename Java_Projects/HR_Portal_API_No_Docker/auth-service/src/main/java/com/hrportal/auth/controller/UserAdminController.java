package com.hrportal.auth.controller;

import java.util.Map;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.hrportal.auth.dto.AuthDtos.AdminResetPasswordRequest;
import com.hrportal.auth.dto.AuthDtos.AssignRolesRequest;
import com.hrportal.auth.dto.AuthDtos.EmployeeMappingRequest;
import com.hrportal.auth.dto.AuthDtos.StatusRequest;
import com.hrportal.auth.dto.AuthDtos.UserResponse;
import com.hrportal.auth.service.UserAdminService;
import com.hrportal.common.web.PageRequests;
import com.hrportal.common.web.PageResponse;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@Tag(name = "User Administration")
@RestController
@RequestMapping("/api/v1/auth/users")
@PreAuthorize("hasAnyRole('HR_ADMIN','SUPER_ADMIN')")
public class UserAdminController {
    private static final Set<String> SORT = Set.of("username", "email", "createdAt", "lastLoginAt", "status");
    private final UserAdminService service;

    public UserAdminController(UserAdminService service) {
        this.service = service;
    }

    @Operation(summary = "Search users (paged, sortable allowlist)")
    @GetMapping
    public PageResponse<UserResponse> search(@RequestParam(required = false) String q, @RequestParam(required = false) String status,
                                             @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
                                             @RequestParam(defaultValue = "username,asc") String sort) {
        return PageResponse.of(service.search(q, status, PageRequests.of(page, size, sort, SORT, "username")));
    }

    @GetMapping("/{id}")
    public UserResponse get(@PathVariable String id) {
        return service.get(id);
    }

    @Operation(summary = "Employee-to-user account lookup")
    @GetMapping("/by-employee/{employeeId}")
    public UserResponse byEmployee(@PathVariable String employeeId) {
        return service.getByEmployee(employeeId);
    }

    @PutMapping("/{id}/roles")
    public UserResponse roles(@PathVariable String id, @Valid @RequestBody AssignRolesRequest req) {
        return service.assignRoles(id, req.roles());
    }

    @Operation(summary = "Activate / deactivate an account")
    @PatchMapping("/{id}/status")
    public UserResponse status(@PathVariable String id, @Valid @RequestBody StatusRequest req) {
        return service.changeStatus(id, req.status());
    }

    @PostMapping("/{id}/unlock")
    public UserResponse unlock(@PathVariable String id) {
        return service.unlock(id);
    }

    @Operation(summary = "Invalidate every live session / token of the user")
    @PostMapping("/{id}/revoke-sessions")
    public Map<String, Integer> revoke(@PathVariable String id) {
        return Map.of("accessTokensRevoked", service.revokeSessions(id));
    }

    @PostMapping("/{id}/reset-password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void reset(@PathVariable String id, @Valid @RequestBody AdminResetPasswordRequest req) {
        service.adminResetPassword(id, req);
    }

    @PutMapping("/{id}/employee-mapping")
    public UserResponse map(@PathVariable String id, @Valid @RequestBody EmployeeMappingRequest req) {
        return service.mapEmployee(id, req.employeeId());
    }
}
