package com.studentmgmt.course.query.entity;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * The READ model — includes categoryName directly (denormalized), so GET
 * /api/courses never needs to JOIN Course_Category. Populated exclusively
 * by CourseChangedProjector.
 */
@Entity
@Table(name = "Courses_View")
public class CourseView {

    @Id
    @Column(name = "course_id")
    private Long courseId;

    @Column(name = "category_id", nullable = false)
    private Long categoryId;

    @Column(name = "category_name", length = 100, nullable = false)
    private String categoryName;

    @Column(name = "course_code", length = 20, nullable = false)
    private String courseCode;

    @Column(name = "course_name", length = 150, nullable = false)
    private String courseName;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "duration_weeks")
    private Integer durationWeeks;

    @Column(name = "credits")
    private Integer credits;

    @Column(name = "fee")
    private BigDecimal fee;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;

    public CourseView() {}

    public Long getCourseId() { return courseId; }
    public void setCourseId(Long courseId) { this.courseId = courseId; }

    public Long getCategoryId() { return categoryId; }
    public void setCategoryId(Long categoryId) { this.categoryId = categoryId; }

    public String getCategoryName() { return categoryName; }
    public void setCategoryName(String categoryName) { this.categoryName = categoryName; }

    public String getCourseCode() { return courseCode; }
    public void setCourseCode(String courseCode) { this.courseCode = courseCode; }

    public String getCourseName() { return courseName; }
    public void setCourseName(String courseName) { this.courseName = courseName; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Integer getDurationWeeks() { return durationWeeks; }
    public void setDurationWeeks(Integer durationWeeks) { this.durationWeeks = durationWeeks; }

    public Integer getCredits() { return credits; }
    public void setCredits(Integer credits) { this.credits = credits; }

    public BigDecimal getFee() { return fee; }
    public void setFee(BigDecimal fee) { this.fee = fee; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
