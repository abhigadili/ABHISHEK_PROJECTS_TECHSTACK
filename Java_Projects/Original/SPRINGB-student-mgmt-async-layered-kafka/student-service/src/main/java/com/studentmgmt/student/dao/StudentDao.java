package com.studentmgmt.student.dao;

import com.studentmgmt.student.model.Student;

import java.util.List;
import java.util.Optional;

public interface StudentDao {

    List<Student> findAll();

    Optional<Student> findById(Long studentId);

    boolean existsById(Long studentId);

    Student save(Student student);

    Student update(Long studentId, Student student);

    void deleteById(Long studentId);
}
