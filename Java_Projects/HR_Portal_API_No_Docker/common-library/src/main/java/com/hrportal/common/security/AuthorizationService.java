package com.hrportal.common.security;

import java.util.Arrays;

import org.springframework.stereotype.Component;

/**
 * Reusable authorization predicates referenced from SpEL: {@code @PreAuthorize("@authz.isSelfOrHr(#employeeId)")}.
 * Business-level "team" checks (is the caller this employee's manager?) are done in the owning service, which
 * knows how to resolve the reporting line.
 */
@Component("authz")
public class AuthorizationService {

    public boolean isSelf(String employeeId) {
        String me = CurrentUser.employeeId();
        return me != null && me.equals(employeeId);
    }

    public boolean isHr() {
        return CurrentUser.isHr();
    }

    public boolean isSelfOrHr(String employeeId) {
        return isSelf(employeeId) || isHr();
    }

    public boolean hasAnyRole(String... roles) {
        return Arrays.stream(roles).anyMatch(r -> CurrentUser.get().map(u -> u.roles().contains(r)).orElse(false));
    }

    public boolean hasPermission(String permission) {
        return CurrentUser.get().map(u -> u.permissions().contains(permission)).orElse(false);
    }

    /** Self, or HR / payroll / finance staff: used for salary, payslip and tax read access. */
    public boolean isSelfOrFinanceStaff(String employeeId) {
        return isSelf(employeeId) || CurrentUser.hasAnyRole(Role.HR_ADMIN, Role.PAYROLL_ADMIN, Role.FINANCE_ADMIN, Role.SUPER_ADMIN);
    }
}
