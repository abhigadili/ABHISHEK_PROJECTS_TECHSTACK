package com.hrportal.attendance.client;

import java.time.LocalDate;
import java.util.List;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

public final class ExternalClients {
    private ExternalClients() {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record HolidayView(String id, String name, LocalDate holidayDate, String type, List<ScopeView> scopes) { }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ScopeView(String scopeType, String scopeId) { }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record EmployeeInfo(String id, String fullName, String managerId, String departmentId, String locationId, String status, LocalDate joiningDate) { }

    /** OpenFeign: Attendance Service -> Holiday Service (holiday calendar of a month for a location). */
    @FeignClient(name = "holiday-service", url = "${hr.services.holiday.url}")
    public interface HolidayClient {
        @GetMapping("/api/v1/holidays/range")
        List<HolidayView> range(@RequestParam("from") String from, @RequestParam("to") String to, @RequestParam(value = "locationId", required = false) String locationId);
    }

    /** OpenFeign: Attendance Service -> Employee Service (fallback when the local employee projection has no row yet). */
    @FeignClient(name = "employee-service", url = "${hr.services.employee.url}")
    public interface EmployeeClient {
        @GetMapping("/api/v1/employees/{id}/summary")
        EmployeeInfo summary(@PathVariable("id") String id);
    }
}
