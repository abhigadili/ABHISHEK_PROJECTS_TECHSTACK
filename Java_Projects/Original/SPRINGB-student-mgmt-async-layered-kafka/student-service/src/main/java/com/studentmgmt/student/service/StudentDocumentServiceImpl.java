package com.studentmgmt.student.service;

import com.studentmgmt.student.dao.StudentDocumentDao;
import com.studentmgmt.student.exception.ResourceNotFoundException;
import com.studentmgmt.student.model.StudentDocument;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class StudentDocumentServiceImpl implements StudentDocumentService {

    private final StudentDocumentDao studentDocumentDao;

    public StudentDocumentServiceImpl(StudentDocumentDao studentDocumentDao) {
        this.studentDocumentDao = studentDocumentDao;
    }

    @Override
    public List<StudentDocument> findAll() {
        return studentDocumentDao.findAll();
    }

    @Override
    public List<StudentDocument> findByStudentId(Long studentId) {
        return studentDocumentDao.findByStudentId(studentId);
    }

    @Override
    public StudentDocument findById(Long documentId) {
        return studentDocumentDao.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Student document not found: " + documentId));
    }

    @Override
    public StudentDocument create(StudentDocument document) {
        return studentDocumentDao.save(document);
    }

    @Override
    public void delete(Long documentId) {
        findById(documentId);
        studentDocumentDao.deleteById(documentId);
    }
}
