package com.studentmgmt.student.controller;

import com.studentmgmt.student.entity.StudentAddress;
import com.studentmgmt.student.service.StudentAddressService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/student-addresses")
public class StudentAddressController {

    private final StudentAddressService studentAddressService;

    public StudentAddressController(StudentAddressService studentAddressService) {
        this.studentAddressService = studentAddressService;
    }

    @GetMapping
    public List<StudentAddress> findAll(@RequestParam(required = false) Long studentId) {
        return studentAddressService.findAll(studentId);
    }

    @GetMapping("/{id}")
    public StudentAddress findById(@PathVariable Long id) {
        return studentAddressService.findById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public StudentAddress create(@Valid @RequestBody StudentAddress address) {
        return studentAddressService.create(address);
    }

    @PutMapping("/{id}")
    public StudentAddress update(@PathVariable Long id, @Valid @RequestBody StudentAddress address) {
        return studentAddressService.update(id, address);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        studentAddressService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
