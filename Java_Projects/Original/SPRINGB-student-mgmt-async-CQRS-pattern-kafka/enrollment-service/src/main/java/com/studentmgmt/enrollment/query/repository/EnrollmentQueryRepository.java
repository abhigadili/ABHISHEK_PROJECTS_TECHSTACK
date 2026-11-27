package com.studentmgmt.enrollment.query.repository;

import com.studentmgmt.enrollment.query.entity.EnrollmentView;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface EnrollmentQueryRepository extends JpaRepository<EnrollmentView, Long> {

    List<EnrollmentView> findByStudentId(Long studentId);

    List<EnrollmentView> findByCourseId(Long courseId);
}
