package com.studentmgmt.student.service;

import com.studentmgmt.student.model.StudentDocument;

import java.util.List;

public interface StudentDocumentService {

    List<StudentDocument> findAll();

    List<StudentDocument> findByStudentId(Long studentId);

    StudentDocument findById(Long documentId);

    StudentDocument create(StudentDocument document);

    void delete(Long documentId);
}
