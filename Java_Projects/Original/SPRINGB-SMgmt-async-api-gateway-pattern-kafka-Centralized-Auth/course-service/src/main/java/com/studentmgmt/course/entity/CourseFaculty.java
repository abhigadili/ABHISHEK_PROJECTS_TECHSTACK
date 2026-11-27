package com.studentmgmt.course.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

@Entity
@Table(name = "Course_Faculty")
public class CourseFaculty {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "faculty_id")
    private Long facultyId;

    @NotNull
    @Column(name = "course_id", nullable = false)
    private Long courseId;

    @NotBlank
    @Column(name = "faculty_name", length = 100, nullable = false)
    private String facultyName;

    @Column(name = "email", length = 100)
    private String email;

    @Column(name = "designation", length = 50)
    private String designation;

    @Column(name = "department", length = 50)
    private String department;

    public CourseFaculty() {}

    public Long getFacultyId() { return facultyId; }
    public void setFacultyId(Long facultyId) { this.facultyId = facultyId; }

    public Long getCourseId() { return courseId; }
    public void setCourseId(Long courseId) { this.courseId = courseId; }

    public String getFacultyName() { return facultyName; }
    public void setFacultyName(String facultyName) { this.facultyName = facultyName; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getDesignation() { return designation; }
    public void setDesignation(String designation) { this.designation = designation; }

    public String getDepartment() { return department; }
    public void setDepartment(String department) { this.department = department; }
}
