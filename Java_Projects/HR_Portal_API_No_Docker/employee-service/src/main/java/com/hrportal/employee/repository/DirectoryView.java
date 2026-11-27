package com.hrportal.employee.repository;

import com.hrportal.employee.entity.Enums.EmployeeStatus;

/** Interface-based PROJECTION: Spring Data selects only these columns (no personal / salary / bank data is even read). */
public interface DirectoryView {
    String getId();

    String getEmployeeCode();

    String getFirstName();

    String getLastName();

    String getWorkEmail();

    String getDepartmentId();

    String getDesignationId();

    String getLocationId();

    EmployeeStatus getStatus();
}
