package com.studentmgmt.enrollment.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/** Minimal shape enrollment-service needs from student-service's GET /api/students/{id} response — everything else is ignored during deserialization. */
@JsonIgnoreProperties(ignoreUnknown = true)
public class StudentSummary {

    private Long studentId;
    private String firstName;
    private String lastName;
    private String email;
    private boolean fromFallback;

    public static StudentSummary fallback(Long studentId) {
        StudentSummary summary = new StudentSummary();
        summary.studentId = studentId;
        summary.firstName = "Unavailable";
        summary.lastName = "(student-service is down)";
        summary.email = null;
        summary.fromFallback = true;
        return summary;
    }

    public Long getStudentId() {
        return studentId;
    }

    public void setStudentId(Long studentId) {
        this.studentId = studentId;
    }

    public String getFirstName() {
        return firstName;
    }

    public void setFirstName(String firstName) {
        this.firstName = firstName;
    }

    public String getLastName() {
        return lastName;
    }

    public void setLastName(String lastName) {
        this.lastName = lastName;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public boolean isFromFallback() {
        return fromFallback;
    }

    public void setFromFallback(boolean fromFallback) {
        this.fromFallback = fromFallback;
    }
}
