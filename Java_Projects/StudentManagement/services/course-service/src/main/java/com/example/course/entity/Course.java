package com.example.course.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/**
 * total_seats / available_seats are NOT updatable through JPA entity saves: they change only through the atomic
 * conditional UPDATE statements in {@link com.example.course.repository.CourseRepository}, so a stale entity can never
 * overwrite concurrent seat changes. {@code version} is bumped by those statements, so concurrent PUTs fail fast (409).
 */
@Entity
@Table(name = "sms_courses")
@Getter @Setter @NoArgsConstructor
public class Course {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "course_id")
    private Long courseId;

    @Column(name = "course_name", nullable = false, length = 120)
    private String courseName;

    @Column(name = "course_code", nullable = false, length = 20, unique = true)
    private String courseCode;

    @Column(columnDefinition = "text")
    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private CourseCategory category;

    @Column(name = "duration_weeks", nullable = false)
    private int durationWeeks;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal fees;

    @Column(name = "total_seats", nullable = false, updatable = false)
    private int totalSeats;

    @Column(name = "available_seats", nullable = false, updatable = false)
    private int availableSeats;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private CourseStatus status = CourseStatus.ACTIVE;

    @Version
    private long version;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
