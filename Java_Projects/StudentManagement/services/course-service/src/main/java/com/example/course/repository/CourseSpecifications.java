package com.example.course.repository;

import com.example.course.entity.Course;
import com.example.course.entity.CourseStatus;
import jakarta.persistence.criteria.Predicate;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.jpa.domain.Specification;

public final class CourseSpecifications {
    private CourseSpecifications() {}

    public static Specification<Course> filter(String search, Long categoryId, CourseStatus status,
                                               BigDecimal minFees, BigDecimal maxFees, boolean availableOnly) {
        return (root, query, cb) -> {
            List<Predicate> p = new ArrayList<>();
            if (search != null && !search.isBlank()) {
                String like = "%" + search.trim().toLowerCase() + "%";
                p.add(cb.or(cb.like(cb.lower(root.get("courseName")), like), cb.like(cb.lower(root.get("courseCode")), like),
                        cb.like(cb.lower(root.get("description")), like)));
            }
            if (categoryId != null) p.add(cb.equal(root.get("category").get("categoryId"), categoryId));
            if (status != null) p.add(cb.equal(root.get("status"), status));
            if (minFees != null) p.add(cb.greaterThanOrEqualTo(root.get("fees"), minFees));
            if (maxFees != null) p.add(cb.lessThanOrEqualTo(root.get("fees"), maxFees));
            if (availableOnly) p.add(cb.greaterThan(root.get("availableSeats"), 0));
            return cb.and(p.toArray(new Predicate[0]));
        };
    }
}
