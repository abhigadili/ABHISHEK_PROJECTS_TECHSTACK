package com.hrportal.employee.controller;

import java.util.List;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.hrportal.common.web.PageRequests;
import com.hrportal.common.web.PageResponse;
import com.hrportal.employee.dto.EmployeeDtos.AddressRequest;
import com.hrportal.employee.dto.EmployeeDtos.AddressResponse;
import com.hrportal.employee.dto.EmployeeDtos.BankDetailRequest;
import com.hrportal.employee.dto.EmployeeDtos.BankDetailResponse;
import com.hrportal.employee.dto.EmployeeDtos.EducationRequest;
import com.hrportal.employee.dto.EmployeeDtos.EducationResponse;
import com.hrportal.employee.dto.EmployeeDtos.EmergencyContactRequest;
import com.hrportal.employee.dto.EmployeeDtos.EmergencyContactResponse;
import com.hrportal.employee.dto.EmployeeDtos.EmploymentHistoryResponse;
import com.hrportal.employee.dto.EmployeeDtos.ExperienceRequest;
import com.hrportal.employee.dto.EmployeeDtos.ExperienceResponse;
import com.hrportal.employee.dto.EmployeeDtos.ProfileChangeResponse;
import com.hrportal.employee.dto.EmployeeDtos.StatusHistoryResponse;
import com.hrportal.employee.service.EmployeeDetailsService;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

/** Employee sub-resources. Access (self or HR) is enforced in the service, where the employee record is known. */
@Tag(name = "Employee Details")
@RestController
@RequestMapping("/api/v1/employees/{employeeId}")
public class EmployeeDetailsController {
    private static final Set<String> LOG_SORT = Set.of("createdAt", "fieldName");
    private final EmployeeDetailsService service;

    public EmployeeDetailsController(EmployeeDetailsService service) {
        this.service = service;
    }

    // addresses
    @GetMapping("/addresses")
    public List<AddressResponse> addresses(@PathVariable String employeeId) {
        return service.addresses(employeeId);
    }

    @PostMapping("/addresses")
    @ResponseStatus(HttpStatus.CREATED)
    public AddressResponse addAddress(@PathVariable String employeeId, @Valid @RequestBody AddressRequest req) {
        return service.addAddress(employeeId, req);
    }

    @PutMapping("/addresses/{id}")
    public AddressResponse updateAddress(@PathVariable String employeeId, @PathVariable String id, @Valid @RequestBody AddressRequest req) {
        return service.updateAddress(employeeId, id, req);
    }

    @DeleteMapping("/addresses/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAddress(@PathVariable String employeeId, @PathVariable String id) {
        service.deleteAddress(employeeId, id);
    }

    // emergency contacts
    @GetMapping("/emergency-contacts")
    public List<EmergencyContactResponse> contacts(@PathVariable String employeeId) {
        return service.contacts(employeeId);
    }

    @PostMapping("/emergency-contacts")
    @ResponseStatus(HttpStatus.CREATED)
    public EmergencyContactResponse addContact(@PathVariable String employeeId, @Valid @RequestBody EmergencyContactRequest req) {
        return service.addContact(employeeId, req);
    }

    @PutMapping("/emergency-contacts/{id}")
    public EmergencyContactResponse updateContact(@PathVariable String employeeId, @PathVariable String id, @Valid @RequestBody EmergencyContactRequest req) {
        return service.updateContact(employeeId, id, req);
    }

    @DeleteMapping("/emergency-contacts/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteContact(@PathVariable String employeeId, @PathVariable String id) {
        service.deleteContact(employeeId, id);
    }

    // education
    @GetMapping("/education")
    public List<EducationResponse> education(@PathVariable String employeeId) {
        return service.education(employeeId);
    }

    @PostMapping("/education")
    @ResponseStatus(HttpStatus.CREATED)
    public EducationResponse addEducation(@PathVariable String employeeId, @Valid @RequestBody EducationRequest req) {
        return service.addEducation(employeeId, req);
    }

    @PutMapping("/education/{id}")
    public EducationResponse updateEducation(@PathVariable String employeeId, @PathVariable String id, @Valid @RequestBody EducationRequest req) {
        return service.updateEducation(employeeId, id, req);
    }

    @DeleteMapping("/education/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteEducation(@PathVariable String employeeId, @PathVariable String id) {
        service.deleteEducation(employeeId, id);
    }

    // experience
    @GetMapping("/experience")
    public List<ExperienceResponse> experience(@PathVariable String employeeId) {
        return service.experience(employeeId);
    }

    @PostMapping("/experience")
    @ResponseStatus(HttpStatus.CREATED)
    public ExperienceResponse addExperience(@PathVariable String employeeId, @Valid @RequestBody ExperienceRequest req) {
        return service.addExperience(employeeId, req);
    }

    @PutMapping("/experience/{id}")
    public ExperienceResponse updateExperience(@PathVariable String employeeId, @PathVariable String id, @Valid @RequestBody ExperienceRequest req) {
        return service.updateExperience(employeeId, id, req);
    }

    @DeleteMapping("/experience/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteExperience(@PathVariable String employeeId, @PathVariable String id) {
        service.deleteExperience(employeeId, id);
    }

    // bank details
    @GetMapping("/bank-details")
    public BankDetailResponse bank(@PathVariable String employeeId) {
        return service.bank(employeeId);
    }

    @PutMapping("/bank-details")
    public BankDetailResponse saveBank(@PathVariable String employeeId, @Valid @RequestBody BankDetailRequest req) {
        return service.saveBank(employeeId, req);
    }

    // history
    @GetMapping("/employment-history")
    public List<EmploymentHistoryResponse> employmentHistory(@PathVariable String employeeId) {
        return service.employmentHistory(employeeId);
    }

    @GetMapping("/profile-history")
    public PageResponse<ProfileChangeResponse> profileHistory(@PathVariable String employeeId, @RequestParam(defaultValue = "0") int page,
                                                              @RequestParam(defaultValue = "20") int size, @RequestParam(defaultValue = "createdAt,desc") String sort) {
        return PageResponse.of(service.profileHistory(employeeId, PageRequests.of(page, size, sort, LOG_SORT, "createdAt")));
    }

    @GetMapping("/status-history")
    public List<StatusHistoryResponse> statusHistory(@PathVariable String employeeId) {
        return service.statusHistory(employeeId);
    }
}
