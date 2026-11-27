package com.studentmgmt.course.command.repository;

import com.studentmgmt.course.command.entity.Course;
import org.springframework.data.jpa.repository.JpaRepository;

/** The write-side, source-of-truth repository — used for the saga's authoritative existence check. */
public interface CourseCommandRepository extends JpaRepository<Course, Long> {
}
