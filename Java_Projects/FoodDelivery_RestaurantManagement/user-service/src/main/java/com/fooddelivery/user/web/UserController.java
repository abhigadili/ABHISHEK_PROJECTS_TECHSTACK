package com.fooddelivery.user.web;

import com.fooddelivery.common.web.PageResponse;
import com.fooddelivery.user.domain.Role;
import com.fooddelivery.user.domain.UserStatus;
import com.fooddelivery.user.service.UserService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@Tag(name = "Users")
public class UserController {
    private final UserService users;

    public UserController(UserService users) { this.users = users; }

    @GetMapping("/api/users/me")
    public Dtos.UserDto me() { return users.me(); }

    @PutMapping("/api/users/me")
    public Dtos.UserDto updateMe(@Valid @RequestBody Dtos.UpdateProfileRequest r) { return users.updateMe(r); }

    @GetMapping("/api/users")
    @PreAuthorize("hasAuthority('PERM_USER_MANAGE')")
    public PageResponse<Dtos.UserDto> search(@RequestParam(required = false) Role role, @RequestParam(required = false) UserStatus status,
                                             @RequestParam(required = false) String q, @RequestParam(defaultValue = "0") int page,
                                             @RequestParam(defaultValue = "20") int size) {
        var p = users.search(role, status, q, PageRequest.of(page, Math.min(size, 100), Sort.by(Sort.Direction.DESC, "createdAt")));
        return new PageResponse<>(p.getContent(), p.getNumber(), p.getSize(), p.getTotalElements(), p.getTotalPages());
    }

    @GetMapping("/api/users/stats")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN','SERVICE')")
    public Map<String, Object> stats() { return users.stats(); }

    @GetMapping("/api/users/{id}")
    @PreAuthorize("hasAuthority('PERM_USER_MANAGE')")
    public Dtos.UserDto get(@PathVariable Long id) { return users.get(id); }

    @PatchMapping("/api/users/{id}/status")
    @PreAuthorize("hasAuthority('PERM_USER_MANAGE')")
    public Dtos.UserDto status(@PathVariable Long id, @Valid @RequestBody Dtos.StatusRequest r) { return users.changeStatus(id, r.status()); }

    @PostMapping("/api/users/admins")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('PERM_ADMIN_CREATE')")
    public Dtos.UserDto createAdmin(@Valid @RequestBody Dtos.CreateAdminRequest r) { return users.createAdmin(r); }

    /** Internal (not routed by the gateway): contact details for the notification service. */
    @GetMapping("/internal/users/{id}/contact")
    @PreAuthorize("hasAnyRole('SERVICE','ADMIN','SUPER_ADMIN')")
    public Dtos.ContactDto contact(@PathVariable Long id) { return users.contact(id); }
}
