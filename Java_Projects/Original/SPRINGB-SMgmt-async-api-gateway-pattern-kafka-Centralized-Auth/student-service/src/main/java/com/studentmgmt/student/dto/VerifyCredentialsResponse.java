package com.studentmgmt.student.dto;

/**
 * Always returned with HTTP 200 (never 401) — the caller (the API Gateway's
 * WebClient) just inspects the `valid` boolean instead of having to handle
 * this as an HTTP error status.
 */
public class VerifyCredentialsResponse {

    private boolean valid;
    private Long studentId;
    private String username;

    public VerifyCredentialsResponse() {
    }

    public static VerifyCredentialsResponse invalid() {
        return new VerifyCredentialsResponse();
    }

    public static VerifyCredentialsResponse valid(Long studentId, String username) {
        VerifyCredentialsResponse response = new VerifyCredentialsResponse();
        response.valid = true;
        response.studentId = studentId;
        response.username = username;
        return response;
    }

    public boolean isValid() {
        return valid;
    }

    public void setValid(boolean valid) {
        this.valid = valid;
    }

    public Long getStudentId() {
        return studentId;
    }

    public void setStudentId(Long studentId) {
        this.studentId = studentId;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }
}
