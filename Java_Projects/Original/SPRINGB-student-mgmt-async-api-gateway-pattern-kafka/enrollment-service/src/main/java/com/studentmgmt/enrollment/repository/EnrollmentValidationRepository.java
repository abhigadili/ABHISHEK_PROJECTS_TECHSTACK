package com.studentmgmt.enrollment.repository;

import com.studentmgmt.enrollment.entity.EnrollmentValidation;
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
     * to null (a classic lost update), since Hibernate's save() issues a
     * full-row UPDATE by default. A bulk JPQL UPDATE only ever touches the
     * three columns named here, so the two threads can never clobber each
     * other regardless of timing.
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
