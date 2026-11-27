package com.studentmgmt.student.dto;

import jakarta.validation.constraints.NotBlank;

/** Body the API Gateway sends to POST /api/student-logins/verify during the login handshake. */
public class VerifyCredentialsRequest {

    @NotBlank
    private String username;

    @NotBlank
    private String password;

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }
}
