package com.hospital.hospital.web;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import com.hospital.hospital.dto.HospitalDtos.*;
import com.hospital.hospital.service.HospitalService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api")
public class HospitalController {
    private final HospitalService service;

    public HospitalController(HospitalService service) {
        this.service = service;
    }

    @PostMapping("/hospitals")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public HospitalResponse create(@Valid @RequestBody HospitalRequest r) {
        return service.create(r);
    }

    @GetMapping("/hospitals")
    public List<HospitalResponse> list() {
        return service.list();
    }

    @GetMapping("/hospitals/{id}")
    public HospitalResponse get(@PathVariable Long id) {
        return service.get(id);
    }

    @PutMapping("/hospitals/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public HospitalResponse update(@PathVariable Long id, @Valid @RequestBody HospitalRequest r) {
        return service.update(id, r);
    }

    @DeleteMapping("/hospitals/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deactivate(@PathVariable Long id) {
        service.deactivate(id);
    }

    @GetMapping("/hospitals/{id}/departments")
    public List<DepartmentResponse> departments(@PathVariable Long id) {
        return service.departments(id);
    }

    @PostMapping("/hospitals/{id}/departments")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public DepartmentResponse addDepartment(@PathVariable Long id, @Valid @RequestBody DepartmentRequest r) {
        return service.addDepartment(id, r);
    }

    @GetMapping("/departments/{id}")
    public DepartmentResponse department(@PathVariable Long id) {
        return service.department(id);
    }

    @PutMapping("/departments/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public DepartmentResponse updateDepartment(@PathVariable Long id, @Valid @RequestBody DepartmentRequest r) {
        return service.updateDepartment(id, r);
    }

    @DeleteMapping("/departments/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deactivateDepartment(@PathVariable Long id) {
        service.deactivateDepartment(id);
    }
}
