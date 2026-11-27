package com.example.enrollment.client;

import com.example.enrollment.client.RemoteDtos.*;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

@FeignClient(name = "course-service", url = "${clients.course-service.url:}", configuration = FeignConfig.class)
public interface CourseClient {
    @GetMapping("/api/courses/{id}")
    CourseInfo get(@PathVariable("id") Long id);

    @GetMapping("/api/courses/{id}/availability")
    AvailabilityInfo availability(@PathVariable("id") Long id);

    @PostMapping("/api/courses/{id}/seats/reserve")
    SeatResult reserve(@PathVariable("id") Long id, @RequestBody SeatCommand command);

    @PostMapping("/api/courses/{id}/seats/release")
    SeatResult release(@PathVariable("id") Long id, @RequestBody SeatCommand command);
}
