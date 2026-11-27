package com.hrportal.timesheet.client;

import java.math.BigDecimal;
import java.time.LocalDate;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/** OpenFeign: Timesheet Service -> Project Service. Hours are only accepted for projects the employee is allocated to on that date. */
@FeignClient(name = "project-service", url = "${hr.services.project.url}")
public interface ProjectClient {

    @JsonIgnoreProperties(ignoreUnknown = true)
    record AllocationCheck(String projectId, String employeeId, LocalDate date, boolean allocated, BigDecimal allocationPercent, boolean billable,
                           String projectStatus, String projectManagerId) { }

    @GetMapping("/api/v1/projects/{projectId}/allocation-check")
    AllocationCheck check(@PathVariable("projectId") String projectId, @RequestParam("employeeId") String employeeId, @RequestParam("date") String date);
}
