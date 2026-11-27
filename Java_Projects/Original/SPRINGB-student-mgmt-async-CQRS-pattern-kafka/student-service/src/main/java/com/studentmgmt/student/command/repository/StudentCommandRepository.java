package com.studentmgmt.student.command.repository;

import com.studentmgmt.student.command.entity.Student;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * The write-side repository — the source of truth. Anything that needs an
 * authoritative "does this student exist" answer (e.g. the enrollment saga's
 * EnrollmentRequestedListener) must go through this repository, never through
 * the query side's StudentQueryRepository / Students_View, which is only
 * eventually consistent.
 */
public interface StudentCommandRepository extends JpaRepository<Student, Long> {
}
