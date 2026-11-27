package com.studentmgmt.student.controller;

import com.studentmgmt.student.dto.VerifyCredentialsRequest;
import com.studentmgmt.student.dto.VerifyCredentialsResponse;
import com.studentmgmt.student.service.StudentLoginService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/student-logins")
public class StudentLoginController {

    private final StudentLoginService studentLoginService;

    public StudentLoginController(StudentLoginService studentLoginService) {
        this.studentLoginService = studentLoginService;
    }

    /**
     * Called only by api-gateway (see api-gateway's StudentLoginClient)
     * during the login handshake — not intended for direct client use.
     * Always 200; the caller inspects the `valid` field.
     */
    @PostMapping("/verify")
    public VerifyCredentialsResponse verify(@Valid @RequestBody VerifyCredentialsRequest request) {
        return studentLoginService.verifyCredentials(request.getUsername(), request.getPassword());
    }
}
