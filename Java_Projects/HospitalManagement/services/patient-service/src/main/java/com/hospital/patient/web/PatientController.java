package com.hospital.patient.web;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import com.hospital.common.client.PatientSummary;
import com.hospital.common.web.PageResponse;
import com.hospital.patient.dto.PatientDtos.PatientRequest;
import com.hospital.patient.dto.PatientDtos.PatientResponse;
import com.hospital.patient.service.PatientService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/patients")
public class PatientController {
    private final PatientService service;

    public PatientController(PatientService service) {
        this.service = service;
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','PATIENT')")
    @ResponseStatus(HttpStatus.CREATED)
    public PatientResponse register(@Valid @RequestBody PatientRequest r) {
        return service.register(r);
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','DOCTOR','LAB_STAFF','PHARMACIST','BILLING_STAFF')")
    public PageResponse<PatientResponse> search(@RequestParam(required = false) String q,
                                                @RequestParam(defaultValue = "0") int page,
                                                @RequestParam(defaultValue = "20") int size) {
        return PageResponse.of(service.search(q, page, size));
    }

    @GetMapping("/{id}")
    public PatientResponse get(@PathVariable Long id) {
        return service.getAuthorized(id);
    }

    /** Minimal projection used by other services via OpenFeign. */
    @GetMapping("/{id}/summary")
    public PatientSummary summary(@PathVariable Long id) {
        return service.summary(id);
    }

    @GetMapping("/by-user/{userId}")
    public PatientSummary byUser(@PathVariable Long userId) {
        return service.summaryByUser(userId);
    }

    @GetMapping("/by-user/{userId}/profile")
    public PatientResponse profileByUser(@PathVariable Long userId) {
        return service.byUserAuthorized(userId);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','PATIENT')")
    public PatientResponse update(@PathVariable Long id, @Valid @RequestBody PatientRequest r) {
        return service.update(id, r);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deactivate(@PathVariable Long id) {
        service.deactivate(id);
    }
}
