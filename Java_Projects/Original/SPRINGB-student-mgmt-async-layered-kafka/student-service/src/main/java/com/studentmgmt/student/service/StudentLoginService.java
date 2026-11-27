package com.studentmgmt.student.service;

import com.studentmgmt.student.model.StudentLogin;

import java.util.List;

public interface StudentLoginService {

    List<StudentLogin> findAll();

    StudentLogin findById(Long loginId);

    StudentLogin findByStudentId(Long studentId);

    StudentLogin create(StudentLogin login);

    StudentLogin update(Long loginId, StudentLogin login);

    void delete(Long loginId);
}
