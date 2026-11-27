package com.studentmgmt.student.service;

import com.studentmgmt.student.entity.StudentLogin;
import com.studentmgmt.student.exception.ResourceNotFoundException;
import com.studentmgmt.student.repository.StudentLoginRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class StudentLoginService {

    private final StudentLoginRepository studentLoginRepository;

    public StudentLoginService(StudentLoginRepository studentLoginRepository) {
        this.studentLoginRepository = studentLoginRepository;
    }

    public List<StudentLogin> findAll(Long studentId) {
        if (studentId != null) {
            return studentLoginRepository.findByStudentId(studentId);
        }
        return studentLoginRepository.findAll();
    }

    public StudentLogin findById(Long id) {
        return studentLoginRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Student login not found: " + id));
    }

    public StudentLogin create(StudentLogin login) {
        return studentLoginRepository.save(login);
    }

    public StudentLogin update(Long id, StudentLogin login) {
        StudentLogin existing = findById(id);
        existing.setStudentId(login.getStudentId());
        existing.setUsername(login.getUsername());
        existing.setPasswordHash(login.getPasswordHash());
        existing.setActive(login.getActive());
        existing.setLastLogin(login.getLastLogin());
        return studentLoginRepository.save(existing);
    }

    public void delete(Long id) {
        findById(id);
        studentLoginRepository.deleteById(id);
    }
}
