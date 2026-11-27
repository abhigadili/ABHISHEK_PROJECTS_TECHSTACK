package com.studentmgmt.enrollment.client;

import com.studentmgmt.enrollment.dto.StudentDto;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.util.Map;

/**
 * Declarative synchronous HTTP contract for student-service. Spring Cloud
 * OpenFeign generates the implementation at startup — no manual URL-building
 * or response-parsing code is written here, unlike the RestTemplate variant
 * of this system. The call is still fully synchronous: invoking any method
 * on this interface blocks the calling thread until student-service responds.
 *
 * No service discovery (Eureka/Consul) is used here, so the target is a
 * fixed URL from application.properties rather than a logical service name.
 */
@FeignClient(name = "student-service", url = "${services.student.base-url}")
public interface StudentFeignClient {

    @GetMapping("/api/students/{id}/exists")
    Map<String, Boolean> exists(@PathVariable("id") Long id);

    @GetMapping("/api/students/{id}")
    StudentDto getStudent(@PathVariable("id") Long id);
}
