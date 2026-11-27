package com.hrportal.employee.repository;

import java.util.ArrayList;
import java.util.List;

import org.springframework.data.jpa.domain.Specification;

import com.hrportal.employee.dto.EmployeeDtos.EmployeeSearchCriteria;
import com.hrportal.employee.entity.Employee;
import com.hrportal.employee.entity.Enums.EmployeeStatus;
import com.hrportal.employee.entity.Enums.EmploymentType;

import jakarta.persistence.criteria.Predicate;

/** Composable search: every filter is optional, all values are bound as parameters by the Criteria API. */
public final class EmployeeSpecifications {
    private EmployeeSpecifications() {
    }

    public static Specification<Employee> from(EmployeeSearchCriteria c) {
        return (root, query, cb) -> {
            List<Predicate> p = new ArrayList<>();
            if (c.q() != null && !c.q().isBlank()) {
                String like = "%" + escapeLike(c.q().trim().toLowerCase()) + "%";
                p.add(cb.or(cb.like(cb.lower(root.get("firstName")), like, '\\'), cb.like(cb.lower(root.get("lastName")), like, '\\'),
                        cb.like(cb.lower(root.get("workEmail")), like, '\\'), cb.like(cb.lower(root.get("employeeCode")), like, '\\')));
            }
            if (c.status() != null) p.add(cb.equal(root.get("status"), EmployeeStatus.valueOf(c.status())));
            if (c.employmentType() != null) p.add(cb.equal(root.get("employmentType"), EmploymentType.valueOf(c.employmentType())));
            if (c.departmentId() != null) p.add(cb.equal(root.get("departmentId"), c.departmentId()));
            if (c.designationId() != null) p.add(cb.equal(root.get("designationId"), c.designationId()));
            if (c.locationId() != null) p.add(cb.equal(root.get("locationId"), c.locationId()));
            if (c.managerId() != null) p.add(cb.equal(root.get("managerId"), c.managerId()));
            if (c.joinedFrom() != null) p.add(cb.greaterThanOrEqualTo(root.get("joiningDate"), c.joinedFrom()));
            if (c.joinedTo() != null) p.add(cb.lessThanOrEqualTo(root.get("joiningDate"), c.joinedTo()));
            return cb.and(p.toArray(new Predicate[0]));
        };
    }

    /** Neutralises % _ and \ typed by the user so they behave as literal characters. */
    static String escapeLike(String s) {
        return s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
