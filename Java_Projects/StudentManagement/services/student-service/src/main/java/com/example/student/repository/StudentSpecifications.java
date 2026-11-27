package com.example.student.repository;

import com.example.student.entity.Gender;
import com.example.student.entity.Student;
import com.example.student.entity.StudentStatus;
import jakarta.persistence.criteria.Predicate;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.jpa.domain.Specification;

public final class StudentSpecifications {
    private StudentSpecifications() {}

    public static Specification<Student> filter(String search, StudentStatus status, Gender gender) {
        return (root, query, cb) -> {
            List<Predicate> p = new ArrayList<>();
            if (search != null && !search.isBlank()) {
                String like = "%" + search.trim().toLowerCase() + "%";
                p.add(cb.or(cb.like(cb.lower(root.get("firstName")), like), cb.like(cb.lower(root.get("lastName")), like),
                        cb.like(cb.lower(root.get("email")), like)));
            }
            if (status != null) p.add(cb.equal(root.get("status"), status));
            if (gender != null) p.add(cb.equal(root.get("gender"), gender));
            return cb.and(p.toArray(new Predicate[0]));
        };
    }
}
