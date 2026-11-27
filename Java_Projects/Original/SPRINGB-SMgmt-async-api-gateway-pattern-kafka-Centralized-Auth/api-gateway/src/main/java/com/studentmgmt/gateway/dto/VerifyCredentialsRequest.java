package com.studentmgmt.gateway.dto;

/** The gateway's own copy of the request shape expected by student-service's POST /api/student-logins/verify. */
public class VerifyCredentialsRequest {

    private String username;
    private String password;

    public VerifyCredentialsRequest() {
    }

    public VerifyCredentialsRequest(String username, String password) {
        this.username = username;
        this.password = password;
    }

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
