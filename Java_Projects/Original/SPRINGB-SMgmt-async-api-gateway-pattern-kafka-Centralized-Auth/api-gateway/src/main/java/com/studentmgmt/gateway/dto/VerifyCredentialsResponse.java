package com.studentmgmt.gateway.dto;

/** The gateway's own copy of the response shape from student-service's POST /api/student-logins/verify. */
public class VerifyCredentialsResponse {

    private boolean valid;
    private Long studentId;
    private String username;

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
