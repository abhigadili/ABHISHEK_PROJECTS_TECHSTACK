package com.hrportal.employee.service;

import org.springframework.stereotype.Component;

import com.hrportal.common.exception.ForbiddenOperationException;
import com.hrportal.common.security.CurrentUser;
import com.hrportal.common.security.Role;
import com.hrportal.employee.dto.EmployeeDtos.EmployeeResponse;

/**
 * Who may see which employee: the employee themself, HR / payroll / finance / super admins, and the employee's own
 * manager. Used both from SpEL (@PostAuthorize("@employeeAccess.canView(returnObject)")) and from service code.
 */
@Component("employeeAccess")
public class EmployeeAccess {

    public boolean canView(EmployeeResponse e) {
        return canView(e.id(), e.managerId());
    }

    public boolean canView(String employeeId, String managerId) {
        if (CurrentUser.hasAnyRole(Role.HR_ADMIN, Role.SUPER_ADMIN, Role.PAYROLL_ADMIN, Role.FINANCE_ADMIN)) return true;
        String me = CurrentUser.employeeId();
        return me != null && (me.equals(employeeId) || me.equals(managerId));
    }

    public void requireSelfOrHr(String employeeId) {
        String me = CurrentUser.employeeId();
        if (CurrentUser.isHr() || (me != null && me.equals(employeeId))) return;
        throw new ForbiddenOperationException("You can only access your own records");
    }

    public void requireSelfOrHrOrManagerOf(String employeeId, String managerId) {
        if (!canViewBasic(employeeId, managerId)) throw new ForbiddenOperationException("You cannot access this employee");
    }

    private boolean canViewBasic(String employeeId, String managerId) {
        if (CurrentUser.isHr()) return true;
        String me = CurrentUser.employeeId();
        return me != null && (me.equals(employeeId) || me.equals(managerId));
    }
}
