package com.example.enrollment.query;

import com.example.enrollment.entity.Enrollment;
import com.example.enrollment.entity.EnrollmentStatus;
import jakarta.persistence.criteria.Predicate;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.jpa.domain.Specification;

final class EnrollmentSpecifications {
    private EnrollmentSpecifications() {}

    static Specification<Enrollment> filter(Long studentId, Long courseId, EnrollmentStatus status, LocalDate from, LocalDate to) {
        return (root, q, cb) -> {
            List<Predicate> p = new ArrayList<>();
            if (studentId != null) p.add(cb.equal(root.get("studentId"), studentId));
            if (courseId != null) p.add(cb.equal(root.get("courseId"), courseId));
            if (status != null) p.add(cb.equal(root.get("status"), status));
            if (from != null) p.add(cb.greaterThanOrEqualTo(root.get("enrollmentDate"), from.atStartOfDay()));
            if (to != null) p.add(cb.lessThan(root.get("enrollmentDate"), to.plusDays(1).atStartOfDay()));
            return cb.and(p.toArray(new Predicate[0]));
        };
    }
}
