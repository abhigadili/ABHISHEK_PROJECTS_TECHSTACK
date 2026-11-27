package com.hrportal.leave.client;

import java.time.LocalDate;
import java.util.List;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/** OpenFeign client: Leave Service -> Employee Service (authoritative manager / gender / status at the moment of applying). */
@FeignClient(name = "employee-service", url = "${hr.services.employee.url}")
public interface EmployeeClient {

    @JsonIgnoreProperties(ignoreUnknown = true)
    record EmployeeInfo(String id, String employeeCode, String fullName, String managerId, String gender, String status,
                        LocalDate joiningDate, String departmentId, String locationId) { }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record TeamMemberInfo(String id, String employeeCode, String firstName, String lastName, String status) { }

    @GetMapping("/api/v1/employees/{id}/summary")
    EmployeeInfo summary(@PathVariable("id") String id);

    @GetMapping("/api/v1/employees/{id}/team")
    List<TeamMemberInfo> team(@PathVariable("id") String managerId);
}
