package com.studentmgmt.student.service;

import com.studentmgmt.student.entity.StudentDocument;
import com.studentmgmt.student.exception.ResourceNotFoundException;
import com.studentmgmt.student.repository.StudentDocumentRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class StudentDocumentService {

    private final StudentDocumentRepository studentDocumentRepository;

    public StudentDocumentService(StudentDocumentRepository studentDocumentRepository) {
        this.studentDocumentRepository = studentDocumentRepository;
    }

    public List<StudentDocument> findAll(Long studentId) {
        if (studentId != null) {
            return studentDocumentRepository.findByStudentId(studentId);
        }
        return studentDocumentRepository.findAll();
    }

    public StudentDocument findById(Long id) {
        return studentDocumentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Student document not found: " + id));
    }

    public StudentDocument create(StudentDocument document) {
        return studentDocumentRepository.save(document);
    }

    public void delete(Long id) {
        findById(id);
        studentDocumentRepository.deleteById(id);
    }
}
