package com.studentmgmt.student.repository;

import com.studentmgmt.student.entity.Student;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Spring Data JPA generates the implementation at runtime and always binds
 * parameters as PreparedStatement placeholders — no method here can be used
 * to inject SQL through a value passed in from a controller.
 */
public interface StudentRepository extends JpaRepository<Student, Long> {
}
