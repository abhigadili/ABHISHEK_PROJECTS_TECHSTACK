package com.example.course.repository;

import com.example.course.entity.CourseCategory;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CourseCategoryRepository extends JpaRepository<CourseCategory, Long> {
    boolean existsByNameIgnoreCase(String name);
}
