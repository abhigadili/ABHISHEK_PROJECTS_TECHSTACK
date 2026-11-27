package com.hospital.doctor.web;

import java.time.LocalDate;
import java.util.List;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import com.hospital.common.web.PageResponse;
import com.hospital.doctor.dto.DoctorDtos.*;
import com.hospital.doctor.service.DoctorService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/doctors")
public class DoctorController {
    private final DoctorService service;

    public DoctorController(DoctorService service) {
        this.service = service;
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public DoctorResponse create(@Valid @RequestBody DoctorRequest r) {
        return service.create(r);
    }

    @GetMapping
    public PageResponse<DoctorResponse> search(@RequestParam(required = false) String specialization,
                                               @RequestParam(required = false) Long hospitalId,
                                               @RequestParam(required = false) Long departmentId,
                                               @RequestParam(required = false) Boolean active,
                                               @RequestParam(defaultValue = "0") int page,
                                               @RequestParam(defaultValue = "20") int size) {
        return PageResponse.of(service.search(specialization, hospitalId, departmentId, active, page, size));
    }

    @GetMapping("/specializations")
    public List<String> specializations() {
        return service.specializations();
    }

    @GetMapping("/available")
    public List<AvailableDoctor> available(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                                           @RequestParam(required = false) String specialization) {
        return service.availableOn(date, specialization);
    }

    @GetMapping("/{id}")
    public DoctorResponse get(@PathVariable Long id) {
        return service.get(id);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public DoctorResponse update(@PathVariable Long id, @Valid @RequestBody DoctorRequest r) {
        return service.update(id, r);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deactivate(@PathVariable Long id) {
        service.deactivate(id);
    }

    @GetMapping("/{id}/slots")
    public List<SlotDto> slots(@PathVariable Long id, @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return service.slots(id, date);
    }

    @GetMapping("/{id}/schedule")
    public List<ScheduleEntry> schedule(@PathVariable Long id) {
        return service.schedule(id);
    }

    @PutMapping("/{id}/schedule")
    @PreAuthorize("hasAnyRole('ADMIN','DOCTOR')")
    public List<ScheduleEntry> replaceSchedule(@PathVariable Long id, @Valid @RequestBody ScheduleRequest r) {
        return service.replaceSchedule(id, r);
    }

    @GetMapping("/{id}/unavailability")
    public List<UnavailabilityResponse> unavailability(@PathVariable Long id) {
        return service.unavailability(id);
    }

    @PostMapping("/{id}/unavailability")
    @PreAuthorize("hasAnyRole('ADMIN','DOCTOR')")
    @ResponseStatus(HttpStatus.CREATED)
    public UnavailabilityResponse addUnavailability(@PathVariable Long id, @Valid @RequestBody UnavailabilityRequest r) {
        return service.addUnavailability(id, r);
    }

    @DeleteMapping("/{id}/unavailability/{unavailabilityId}")
    @PreAuthorize("hasAnyRole('ADMIN','DOCTOR')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeUnavailability(@PathVariable Long id, @PathVariable Long unavailabilityId) {
        service.removeUnavailability(id, unavailabilityId);
    }
}
