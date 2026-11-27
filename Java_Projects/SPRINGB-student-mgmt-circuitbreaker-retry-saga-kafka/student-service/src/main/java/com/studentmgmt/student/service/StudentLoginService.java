package com.studentmgmt.student.service;

import com.studentmgmt.student.dto.VerifyCredentialsResponse;
import com.studentmgmt.student.entity.StudentLogin;
import com.studentmgmt.student.repository.StudentLoginRepository;
import org.springframework.stereotype.Service;

/**
 * verifyCredentials() is called only by api-gateway (via its
 * StudentLoginClient) during the login handshake. The comparison below is a
 * PLAIN STRING equality check — deliberately simplified for teaching, this
 * is the one place password_hash is actually compared. A real system would
 * hash the incoming password the same way the stored value was hashed
 * (BCrypt, Argon2, ...) and compare hashes, never plain text.
 */
@Service
public class StudentLoginService {

    private final StudentLoginRepository studentLoginRepository;

    public StudentLoginService(StudentLoginRepository studentLoginRepository) {
        this.studentLoginRepository = studentLoginRepository;
    }

    public VerifyCredentialsResponse verifyCredentials(String username, String password) {
        return studentLoginRepository.findByUsername(username)
                .filter(login -> Boolean.TRUE.equals(login.getActive()))
                .filter(login -> login.getPasswordHash().equals(password))
                .map(login -> new VerifyCredentialsResponse(true, login.getUsername(), login.getRole().name()))
                .orElseGet(() -> new VerifyCredentialsResponse(false, username, null));
    }
}
