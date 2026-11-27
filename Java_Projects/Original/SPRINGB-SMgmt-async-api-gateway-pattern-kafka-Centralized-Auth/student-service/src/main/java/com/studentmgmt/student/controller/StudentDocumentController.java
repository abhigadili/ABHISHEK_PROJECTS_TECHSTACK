package com.studentmgmt.student.controller;

import com.studentmgmt.student.entity.StudentDocument;
import com.studentmgmt.student.service.StudentDocumentService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/student-documents")
public class StudentDocumentController {

    private final StudentDocumentService studentDocumentService;

    public StudentDocumentController(StudentDocumentService studentDocumentService) {
        this.studentDocumentService = studentDocumentService;
    }

    @GetMapping
    public List<StudentDocument> findAll(@RequestParam(required = false) Long studentId) {
        return studentDocumentService.findAll(studentId);
    }

    @GetMapping("/{id}")
    public StudentDocument findById(@PathVariable Long id) {
        return studentDocumentService.findById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public StudentDocument create(@Valid @RequestBody StudentDocument document) {
        return studentDocumentService.create(document);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        studentDocumentService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
