package com.studentmgmt.enrollment.repository;

import com.studentmgmt.enrollment.entity.EnrollmentValidation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface EnrollmentValidationRepository extends JpaRepository<EnrollmentValidation, Long> {

    @Modifying
    @Transactional
    @Query("UPDATE EnrollmentValidation v SET v.studentValid = :valid, v.studentReason = :reason, " +
           "v.studentCheckedAt = CURRENT_TIMESTAMP WHERE v.enrollmentId = :enrollmentId")
    void updateStudentResult(@Param("enrollmentId") Long enrollmentId, @Param("valid") boolean valid, @Param("reason") String reason);

    @Modifying
    @Transactional
    @Query("UPDATE EnrollmentValidation v SET v.courseValid = :valid, v.courseReason = :reason, " +
           "v.courseCheckedAt = CURRENT_TIMESTAMP WHERE v.enrollmentId = :enrollmentId")
    void updateCourseResult(@Param("enrollmentId") Long enrollmentId, @Param("valid") boolean valid, @Param("reason") String reason);
}
