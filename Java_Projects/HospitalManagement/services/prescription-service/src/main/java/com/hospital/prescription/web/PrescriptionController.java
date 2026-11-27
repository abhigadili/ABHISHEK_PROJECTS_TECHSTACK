package com.hospital.prescription.web;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import com.hospital.prescription.dto.PrescriptionDtos.*;
import com.hospital.prescription.service.PrescriptionService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/prescriptions")
public class PrescriptionController {
    private final PrescriptionService service;

    public PrescriptionController(PrescriptionService service) {
        this.service = service;
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','DOCTOR')")
    @ResponseStatus(HttpStatus.CREATED)
    public PrescriptionResponse create(@Valid @RequestBody PrescriptionRequest r) {
        return service.create(r);
    }

    @GetMapping("/{id}")
    public PrescriptionResponse get(@PathVariable Long id) {
        return service.get(id);
    }

    @GetMapping("/{id}/status")
    public StatusResponse status(@PathVariable Long id) {
        return service.status(id);
    }

    @GetMapping("/patient/{patientId}")
    @PreAuthorize("hasAnyRole('ADMIN','DOCTOR','PATIENT','PHARMACIST')")
    public List<PrescriptionResponse> forPatient(@PathVariable Long patientId) {
        return service.forPatient(patientId);
    }

    @GetMapping("/doctor/{doctorId}")
    @PreAuthorize("hasAnyRole('ADMIN','DOCTOR')")
    public List<PrescriptionResponse> forDoctor(@PathVariable Long doctorId) {
        return service.forDoctor(doctorId);
    }

    @PutMapping("/{id}/cancel")
    @PreAuthorize("hasAnyRole('ADMIN','DOCTOR')")
    public StatusResponse cancel(@PathVariable Long id) {
        return service.cancel(id);
    }
}
