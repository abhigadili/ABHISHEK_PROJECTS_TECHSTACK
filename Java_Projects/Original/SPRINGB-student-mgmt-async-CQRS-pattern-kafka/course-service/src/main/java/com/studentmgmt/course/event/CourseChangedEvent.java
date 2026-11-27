package com.studentmgmt.course.event;

import java.math.BigDecimal;

/**
 * Published to `course.changed` by CourseCommandService. Notice categoryName
 * is carried here even though Course itself only stores categoryId —
 * CourseCommandService looks the name up once at write time so
 * CourseChangedProjector never has to join Course_Category to populate
 * Courses_View. This is the actual CQRS payoff: reads are pre-joined.
 */
public class CourseChangedEvent {

    public static final String CREATED = "CREATED";
    public static final String UPDATED = "UPDATED";
    public static final String DELETED = "DELETED";

    private String operation;
    private Long courseId;
    private Long categoryId;
    private String categoryName;
    private String courseCode;
    private String courseName;
    private String description;
    private Integer durationWeeks;
    private Integer credits;
    private BigDecimal fee;

    public String getOperation() {
        return operation;
    }

    public void setOperation(String operation) {
        this.operation = operation;
    }

    public Long getCourseId() {
        return courseId;
    }

    public void setCourseId(Long courseId) {
        this.courseId = courseId;
    }

    public Long getCategoryId() {
        return categoryId;
    }

    public void setCategoryId(Long categoryId) {
        this.categoryId = categoryId;
    }

    public String getCategoryName() {
        return categoryName;
    }

    public void setCategoryName(String categoryName) {
        this.categoryName = categoryName;
    }

    public String getCourseCode() {
        return courseCode;
    }

    public void setCourseCode(String courseCode) {
        this.courseCode = courseCode;
    }

    public String getCourseName() {
        return courseName;
    }

    public void setCourseName(String courseName) {
        this.courseName = courseName;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Integer getDurationWeeks() {
        return durationWeeks;
    }

    public void setDurationWeeks(Integer durationWeeks) {
        this.durationWeeks = durationWeeks;
    }

    public Integer getCredits() {
        return credits;
    }

    public void setCredits(Integer credits) {
        this.credits = credits;
    }

    public BigDecimal getFee() {
        return fee;
    }

    public void setFee(BigDecimal fee) {
        this.fee = fee;
    }
}
