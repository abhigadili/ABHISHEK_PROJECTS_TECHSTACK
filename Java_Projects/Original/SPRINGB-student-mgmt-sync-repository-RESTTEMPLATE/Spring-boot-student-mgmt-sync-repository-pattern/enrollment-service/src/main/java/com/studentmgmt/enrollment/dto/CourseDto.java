package com.studentmgmt.enrollment.dto;

import java.math.BigDecimal;

/** Client-side shape of the JSON course-service returns from GET /api/courses/{id}. */
public class CourseDto {

    private Long courseId;
    private String courseName;
    private String courseCode;
    private BigDecimal fee;

    public Long getCourseId() { return courseId; }
    public void setCourseId(Long courseId) { this.courseId = courseId; }

    public String getCourseName() { return courseName; }
    public void setCourseName(String courseName) { this.courseName = courseName; }

    public String getCourseCode() { return courseCode; }
    public void setCourseCode(String courseCode) { this.courseCode = courseCode; }

    public BigDecimal getFee() { return fee; }
    public void setFee(BigDecimal fee) { this.fee = fee; }
}
