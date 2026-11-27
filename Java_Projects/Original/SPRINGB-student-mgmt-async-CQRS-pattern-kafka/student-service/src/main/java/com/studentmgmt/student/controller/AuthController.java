package com.studentmgmt.student.controller;

import com.studentmgmt.student.dto.LoginRequest;
import com.studentmgmt.student.dto.LoginResponse;
import com.studentmgmt.student.entity.StudentLogin;
import com.studentmgmt.student.repository.StudentLoginRepository;
import com.studentmgmt.student.security.JwtUtil;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.Optional;

/**
 * The only place in the whole system a JWT is minted. Every other service —
 * including this one, for its own /api/students/** endpoints — only ever
 * validates a token via JwtAuthFilter; none of them can issue one. This is
 * what makes it "single sign-on without a gateway": log in here once, then
 * present the same token to course-service/enrollment-service/notification-
 * service, and each validates it independently against the shared secret.
 */
@RestController
public class AuthController {

    private final StudentLoginRepository studentLoginRepository;
    private final JwtUtil jwtUtil;

    public AuthController(StudentLoginRepository studentLoginRepository, JwtUtil jwtUtil) {
        this.studentLoginRepository = studentLoginRepository;
        this.jwtUtil = jwtUtil;
    }

    /**
     * Compares the password against Student_Login.password_hash with a plain
     * equals() — a simplification for this demo. A real system would hash the
     * incoming password the same way the stored value was hashed (e.g.
     * BCryptPasswordEncoder.matches(raw, stored)), never compare raw strings.
     */
    @PostMapping("/auth/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request) {
        Optional<StudentLogin> match = studentLoginRepository.findByUsername(request.getUsername())
                .filter(login -> Boolean.TRUE.equals(login.getActive()))
                .filter(login -> login.getPasswordHash().equals(request.getPassword()));

        if (match.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body("Invalid username/password, or account inactive");
        }
        return ResponseEntity.ok(new LoginResponse(jwtUtil.generateToken(match.get().getUsername())));
    }
}
