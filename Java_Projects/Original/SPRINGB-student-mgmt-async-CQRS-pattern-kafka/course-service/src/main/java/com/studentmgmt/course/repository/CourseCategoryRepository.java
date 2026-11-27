package com.studentmgmt.course.repository;

import com.studentmgmt.course.entity.CourseCategory;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CourseCategoryRepository extends JpaRepository<CourseCategory, Long> {
}
