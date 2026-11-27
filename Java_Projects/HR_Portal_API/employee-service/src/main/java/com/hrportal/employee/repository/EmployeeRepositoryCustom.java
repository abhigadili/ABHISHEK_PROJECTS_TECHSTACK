package com.hrportal.employee.repository;

import java.util.List;

import com.hrportal.employee.dto.EmployeeDtos.DepartmentStatusCount;
import com.hrportal.employee.dto.EmployeeDtos.ManagerSpan;

/** Custom repository fragment implemented with the JPA Criteria API (type-safe group-by queries). */
public interface EmployeeRepositoryCustom {
    List<DepartmentStatusCount> headcountByDepartmentAndStatus();

    List<ManagerSpan> topManagersBySpan(int limit);
}
