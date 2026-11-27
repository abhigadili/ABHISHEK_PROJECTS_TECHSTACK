package com.example.course.mapper;

import com.example.course.dto.CategoryDtos.CategoryResponse;
import com.example.course.dto.CourseAvailabilityResponse;
import com.example.course.dto.CourseRequest;
import com.example.course.dto.CourseResponse;
import com.example.course.entity.Course;
import com.example.course.entity.CourseCategory;
import com.example.course.entity.CourseStatus;
import org.springframework.stereotype.Component;

@Component
public class CourseMapper {

    public Course toEntity(CourseRequest r, CourseCategory category) {
        Course c = new Course();
        apply(r, c, category);
        c.setTotalSeats(r.totalSeats());
        c.setAvailableSeats(r.totalSeats());
        return c;
    }

    /** Copies mutable fields; seat counts are handled separately by atomic updates. */
    public void apply(CourseRequest r, Course c, CourseCategory category) {
        c.setCourseName(r.courseName().trim());
        c.setCourseCode(r.courseCode().trim());
        c.setDescription(r.description());
        c.setCategory(category);
        c.setDurationWeeks(r.durationWeeks());
        c.setFees(r.fees());
        if (r.status() != null) c.setStatus(r.status());
        else if (c.getStatus() == null) c.setStatus(CourseStatus.ACTIVE);
    }

    public CourseResponse toResponse(Course c) {
        CourseCategory cat = c.getCategory();
        return new CourseResponse(c.getCourseId(), c.getCourseName(), c.getCourseCode(), c.getDescription(),
                cat == null ? null : cat.getCategoryId(), cat == null ? null : cat.getName(), c.getDurationWeeks(),
                c.getFees(), c.getTotalSeats(), c.getAvailableSeats(), c.getStatus(), c.getCreatedAt(), c.getUpdatedAt());
    }

    public CourseAvailabilityResponse toAvailability(Course c) {
        return new CourseAvailabilityResponse(c.getCourseId(), c.getStatus(), c.getTotalSeats(), c.getAvailableSeats(),
                c.getStatus() == CourseStatus.ACTIVE && c.getAvailableSeats() > 0);
    }

    public CategoryResponse toResponse(CourseCategory c) { return new CategoryResponse(c.getCategoryId(), c.getName(), c.getDescription()); }
}
