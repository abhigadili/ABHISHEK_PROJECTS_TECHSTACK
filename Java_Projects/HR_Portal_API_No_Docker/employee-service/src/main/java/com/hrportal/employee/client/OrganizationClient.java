package com.hrportal.employee.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * OpenFeign client: Employee Service -> Organization Service (synchronous validation of department / designation /
 * location ids when an employee is onboarded or transferred). Authorization + correlation id are added by the global
 * Feign interceptor of the common library; timeouts come from spring.cloud.openfeign.client.config.default.
 */
@FeignClient(name = "organization-service", url = "${hr.services.organization.url}")
public interface OrganizationClient {

    @JsonIgnoreProperties(ignoreUnknown = true)
    record OrgRef(String id, Boolean active) { }

    @GetMapping("/api/v1/organization/departments/{id}")
    OrgRef department(@PathVariable("id") String id);

    @GetMapping("/api/v1/organization/designations/{id}")
    OrgRef designation(@PathVariable("id") String id);

    @GetMapping("/api/v1/organization/locations/{id}")
    OrgRef location(@PathVariable("id") String id);

    @GetMapping("/api/v1/organization/job-grades/{id}")
    OrgRef jobGrade(@PathVariable("id") String id);
}
