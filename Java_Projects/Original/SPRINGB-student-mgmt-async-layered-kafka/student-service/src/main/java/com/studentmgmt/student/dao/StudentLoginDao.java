package com.studentmgmt.student.dao;

import com.studentmgmt.student.model.StudentLogin;

import java.util.List;
import java.util.Optional;

public interface StudentLoginDao {

    List<StudentLogin> findAll();

    Optional<StudentLogin> findById(Long loginId);

    Optional<StudentLogin> findByStudentId(Long studentId);

    StudentLogin save(StudentLogin login);

    StudentLogin update(Long loginId, StudentLogin login);

    void deleteById(Long loginId);
}
