package com.studentmgmt.enrollment.dto;

/**
 * Client-side shape of the JSON student-service returns from GET /api/students/{id}.
 * Deliberately a separate, minimal copy rather than a shared library —
 * each microservice owns its own view of a peer's contract, so student-service
 * can add/rename fields it doesn't expose here without breaking this service.
 */
public class StudentDto {

    private Long studentId;
    private String firstName;
    private String lastName;
    private String email;
    private String phone;

    public Long getStudentId() { return studentId; }
    public void setStudentId(Long studentId) { this.studentId = studentId; }

    public String getFirstName() { return firstName; }
    public void setFirstName(String firstName) { this.firstName = firstName; }

    public String getLastName() { return lastName; }
    public void setLastName(String lastName) { this.lastName = lastName; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
}
