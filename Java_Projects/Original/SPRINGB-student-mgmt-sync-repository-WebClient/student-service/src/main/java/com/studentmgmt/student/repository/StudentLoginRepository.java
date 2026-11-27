package com.studentmgmt.student.repository;

import com.studentmgmt.student.entity.StudentLogin;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface StudentLoginRepository extends JpaRepository<StudentLogin, Long> {

    List<StudentLogin> findByStudentId(Long studentId);

    Optional<StudentLogin> findByUsername(String username);
}
