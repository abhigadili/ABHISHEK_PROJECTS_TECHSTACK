package com.hospital.appointment.web;

import java.time.LocalDate;
import java.util.List;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import com.hospital.appointment.dto.AppointmentDtos.*;
import com.hospital.appointment.service.AppointmentService;
import com.hospital.common.client.SlotView;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/appointments")
public class AppointmentController {
    private final AppointmentService service;

    public AppointmentController(AppointmentService service) {
        this.service = service;
    }

    @GetMapping("/availability")
    public List<SlotView> availability(@RequestParam Long doctorId, @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return service.availability(doctorId, date);
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','PATIENT')")
    @ResponseStatus(HttpStatus.CREATED)
    public AppointmentResponse book(@Valid @RequestBody BookRequest r) {
        return service.book(r);
    }

    @GetMapping("/{id}")
    public AppointmentResponse get(@PathVariable Long id) {
        return service.get(id);
    }

    @GetMapping("/my")
    @PreAuthorize("hasRole('PATIENT')")
    public List<AppointmentResponse> mine() {
        return service.mine();
    }

    @GetMapping("/patient/{patientId}")
    public List<AppointmentResponse> forPatient(@PathVariable Long patientId) {
        return service.forPatient(patientId);
    }

    @GetMapping("/doctor/{doctorId}")
    @PreAuthorize("hasAnyRole('ADMIN','DOCTOR')")
    public List<AppointmentResponse> forDoctor(@PathVariable Long doctorId,
                                               @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return service.forDoctor(doctorId, date);
    }

    @PutMapping("/{id}/reschedule")
    @PreAuthorize("hasAnyRole('ADMIN','DOCTOR','PATIENT')")
    public AppointmentResponse reschedule(@PathVariable Long id, @Valid @RequestBody RescheduleRequest r) {
        return service.reschedule(id, r);
    }

    @PutMapping("/{id}/cancel")
    @PreAuthorize("hasAnyRole('ADMIN','DOCTOR','PATIENT')")
    public AppointmentResponse cancel(@PathVariable Long id, @RequestBody(required = false) CancelRequest r) {
        return service.cancel(id, r == null ? null : r.getReason());
    }

    @PutMapping("/{id}/complete")
    @PreAuthorize("hasAnyRole('ADMIN','DOCTOR')")
    public AppointmentResponse complete(@PathVariable Long id, @RequestBody(required = false) CompleteRequest r) {
        return service.complete(id, r == null ? null : r.getNotes());
    }
}
