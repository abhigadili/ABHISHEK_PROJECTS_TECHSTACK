package com.studentmgmt.enrollment.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/** Minimal shape enrollment-service needs from course-service's GET /api/courses/{id} response. */
@JsonIgnoreProperties(ignoreUnknown = true)
public class CourseSummary {

    private Long courseId;
    private String courseName;
    private boolean fromFallback;

    public static CourseSummary fallback(Long courseId) {
        CourseSummary summary = new CourseSummary();
        summary.courseId = courseId;
        summary.courseName = "Unavailable (course-service is down)";
        summary.fromFallback = true;
        return summary;
    }

    public Long getCourseId() {
        return courseId;
    }

    public void setCourseId(Long courseId) {
        this.courseId = courseId;
    }

    public String getCourseName() {
        return courseName;
    }

    public void setCourseName(String courseName) {
        this.courseName = courseName;
    }

    public boolean isFromFallback() {
        return fromFallback;
    }

    public void setFromFallback(boolean fromFallback) {
        this.fromFallback = fromFallback;
    }
}
