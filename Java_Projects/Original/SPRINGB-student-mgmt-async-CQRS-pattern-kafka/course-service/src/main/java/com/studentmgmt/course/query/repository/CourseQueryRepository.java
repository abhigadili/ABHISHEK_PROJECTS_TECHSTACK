package com.studentmgmt.course.query.repository;

import com.studentmgmt.course.query.entity.CourseView;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CourseQueryRepository extends JpaRepository<CourseView, Long> {

    List<CourseView> findByCategoryId(Long categoryId);
}
