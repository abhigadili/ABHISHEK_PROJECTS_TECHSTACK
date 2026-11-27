package com.studentmgmt.enrollment.command.repository;

import com.studentmgmt.enrollment.command.entity.EnrollmentValidation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EnrollmentValidationRepository extends JpaRepository<EnrollmentValidation, Long> {

    /**
     * Deliberately a targeted single-column bulk update, NOT
     * findById().set...().save() — the student and course validation
     * results arrive on two different Kafka listener threads at roughly the
     * same time. A load-mutate-save on the full entity would let whichever
     * thread commits last silently overwrite the other thread's column back
     * to null (a lost update), since Hibernate's save() issues a full-row
     * UPDATE by default. This exact bug was found and fixed the same way in
     * the sibling api-gateway-pattern project — see that project's guide for
     * the full story of how it was diagnosed.
     */
    @Modifying
    @Query("UPDATE EnrollmentValidation e SET e.studentValid = :valid, e.studentReason = :reason, " +
            "e.studentCheckedAt = CURRENT_TIMESTAMP WHERE e.enrollmentId = :enrollmentId")
    void updateStudentResult(@Param("enrollmentId") Long enrollmentId, @Param("valid") boolean valid, @Param("reason") String reason);

    @Modifying
    @Query("UPDATE EnrollmentValidation e SET e.courseValid = :valid, e.courseReason = :reason, " +
            "e.courseCheckedAt = CURRENT_TIMESTAMP WHERE e.enrollmentId = :enrollmentId")
    void updateCourseResult(@Param("enrollmentId") Long enrollmentId, @Param("valid") boolean valid, @Param("reason") String reason);
}
