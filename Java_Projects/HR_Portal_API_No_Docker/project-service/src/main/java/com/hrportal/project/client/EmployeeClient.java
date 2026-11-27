package com.hrportal.project.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/** OpenFeign: Project Service -> Employee Service (an allocation or a project manager must be an existing, active employee). */
@FeignClient(name = "employee-service", url = "${hr.services.employee.url}")
public interface EmployeeClient {

    @JsonIgnoreProperties(ignoreUnknown = true)
    record EmployeeInfo(String id, String fullName, String status) { }

    @GetMapping("/api/v1/employees/{id}/summary")
    EmployeeInfo summary(@PathVariable("id") String id);
}
