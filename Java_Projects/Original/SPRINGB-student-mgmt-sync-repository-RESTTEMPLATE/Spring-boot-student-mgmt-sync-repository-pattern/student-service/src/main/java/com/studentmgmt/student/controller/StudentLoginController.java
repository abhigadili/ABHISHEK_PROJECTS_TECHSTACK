package com.studentmgmt.student.controller;

import com.studentmgmt.student.entity.StudentLogin;
import com.studentmgmt.student.service.StudentLoginService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/student-logins")
public class StudentLoginController {

    private final StudentLoginService studentLoginService;

    public StudentLoginController(StudentLoginService studentLoginService) {
        this.studentLoginService = studentLoginService;
    }

    @GetMapping
    public List<StudentLogin> findAll(@RequestParam(required = false) Long studentId) {
        return studentLoginService.findAll(studentId);
    }

    @GetMapping("/{id}")
    public StudentLogin findById(@PathVariable Long id) {
        return studentLoginService.findById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public StudentLogin create(@Valid @RequestBody StudentLogin login) {
        return studentLoginService.create(login);
    }

    @PutMapping("/{id}")
    public StudentLogin update(@PathVariable Long id, @Valid @RequestBody StudentLogin login) {
        return studentLoginService.update(id, login);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        studentLoginService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
