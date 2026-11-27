package com.studentmgmt.student.query.controller;

import com.studentmgmt.student.query.entity.StudentView;
import com.studentmgmt.student.query.service.StudentQueryService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Read-only: every GET here comes from Students_View, never from Students directly. */
@RestController
@RequestMapping("/api/students")
public class StudentQueryController {

    private final StudentQueryService studentQueryService;

    public StudentQueryController(StudentQueryService studentQueryService) {
        this.studentQueryService = studentQueryService;
    }

    @GetMapping
    public List<StudentView> findAll() {
        return studentQueryService.findAll();
    }

    @GetMapping("/{id}")
    public StudentView findById(@PathVariable Long id) {
        return studentQueryService.findById(id);
    }
}
