package com.studentmgmt.student.dao;

import com.studentmgmt.student.model.StudentDocument;

import java.util.List;
import java.util.Optional;

public interface StudentDocumentDao {

    List<StudentDocument> findAll();

    List<StudentDocument> findByStudentId(Long studentId);

    Optional<StudentDocument> findById(Long documentId);

    StudentDocument save(StudentDocument document);

    void deleteById(Long documentId);
}
