package com.studentmgmt.student.command.controller;

import com.studentmgmt.student.command.entity.Student;
import com.studentmgmt.student.command.service.StudentCommandService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Write-only: POST/PUT/DELETE. There is deliberately no GET here — reads go
 * through StudentQueryController against the separate read model. Sending a
 * GET to this controller's path still works because Spring maps by HTTP
 * method+path across controllers, but the query side owns every GET.
 */
@RestController
@RequestMapping("/api/students")
public class StudentCommandController {

    private final StudentCommandService studentCommandService;

    public StudentCommandController(StudentCommandService studentCommandService) {
        this.studentCommandService = studentCommandService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Student create(@Valid @RequestBody Student student) {
        return studentCommandService.create(student);
    }

    @PutMapping("/{id}")
    public Student update(@PathVariable Long id, @Valid @RequestBody Student student) {
        return studentCommandService.update(id, student);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        studentCommandService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
