package com.studentmgmt.enrollment.client;

import com.studentmgmt.enrollment.dto.CourseDto;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.util.Map;

/** Declarative synchronous HTTP contract for course-service. */
@FeignClient(name = "course-service", url = "${services.course.base-url}")
public interface CourseFeignClient {

    @GetMapping("/api/courses/{id}/exists")
    Map<String, Boolean> exists(@PathVariable("id") Long id);

    @GetMapping("/api/courses/{id}")
    CourseDto getCourse(@PathVariable("id") Long id);
}
