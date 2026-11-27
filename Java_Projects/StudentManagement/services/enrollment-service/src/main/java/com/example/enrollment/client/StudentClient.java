package com.example.enrollment.client;

import com.example.enrollment.client.RemoteDtos.EligibilityInfo;
import com.example.enrollment.client.RemoteDtos.StudentInfo;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

/** Resolved through Eureka by service name (client-side load balancing); {@code clients.student-service.url} overrides for tests. */
@FeignClient(name = "student-service", url = "${clients.student-service.url:}", configuration = FeignConfig.class)
public interface StudentClient {
    @GetMapping("/api/students/{id}")
    StudentInfo get(@PathVariable("id") Long id);

    @GetMapping("/api/students/{id}/eligibility")
    EligibilityInfo eligibility(@PathVariable("id") Long id);
}
