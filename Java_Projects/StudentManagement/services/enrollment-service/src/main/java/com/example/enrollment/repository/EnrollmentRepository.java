package com.example.enrollment.repository;

import com.example.enrollment.entity.Enrollment;
import com.example.enrollment.entity.EnrollmentStatus;
import java.util.Collection;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface EnrollmentRepository extends JpaRepository<Enrollment, Long>, JpaSpecificationExecutor<Enrollment> {
    Optional<Enrollment> findByIdempotencyKey(String key);
    boolean existsByStudentIdAndCourseIdAndStatusIn(Long studentId, Long courseId, Collection<EnrollmentStatus> statuses);
}
