package com.studentmgmt.student.service;

import com.studentmgmt.student.dto.VerifyCredentialsResponse;
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

    /**
     * Called by the API Gateway's AuthController during POST /auth/login —
     * this is the one place password_hash is actually compared. A plain
     * equals() against the seeded demo hash is a simplification for this
     * project; a real system would hash the incoming password the same way
     * the stored value was hashed (e.g. BCryptPasswordEncoder.matches) and
     * never compare raw strings.
     */
    public VerifyCredentialsResponse verifyCredentials(String username, String password) {
        return studentLoginRepository.findByUsername(username)
                .filter(login -> Boolean.TRUE.equals(login.getActive()))
                .filter(login -> login.getPasswordHash().equals(password))
                .map(login -> VerifyCredentialsResponse.valid(login.getStudentId(), login.getUsername()))
                .orElseGet(VerifyCredentialsResponse::invalid);
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
