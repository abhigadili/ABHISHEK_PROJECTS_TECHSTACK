package com.studentmgmt.student.service;

import com.studentmgmt.student.model.Student;

import java.util.List;

public interface StudentService {

    List<Student> findAll();

    Student findById(Long id);

    boolean existsById(Long id);

    Student create(Student student);

    Student update(Long id, Student student);

    void delete(Long id);
}
