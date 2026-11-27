package com.studentmgmt.student.query.service;

import com.studentmgmt.student.exception.ResourceNotFoundException;
import com.studentmgmt.student.query.entity.StudentView;
import com.studentmgmt.student.query.repository.StudentQueryRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class StudentQueryService {

    private final StudentQueryRepository studentQueryRepository;

    public StudentQueryService(StudentQueryRepository studentQueryRepository) {
        this.studentQueryRepository = studentQueryRepository;
    }

    public List<StudentView> findAll() {
        return studentQueryRepository.findAll();
    }

    public StudentView findById(Long id) {
        return studentQueryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Student not found: " + id));
    }
}
