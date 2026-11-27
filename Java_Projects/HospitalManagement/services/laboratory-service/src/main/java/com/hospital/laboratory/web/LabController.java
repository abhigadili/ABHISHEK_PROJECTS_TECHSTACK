package com.hospital.laboratory.web;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import com.hospital.common.web.PageResponse;
import com.hospital.laboratory.domain.LabStatus;
import com.hospital.laboratory.dto.LabDtos.*;
import com.hospital.laboratory.service.LabService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/lab")
public class LabController {
    private final LabService service;

    public LabController(LabService service) {
        this.service = service;
    }

    @GetMapping("/tests")
    public List<TestResponse> catalogue() {
        return service.catalogue();
    }

    @PostMapping("/tests")
    @PreAuthorize("hasAnyRole('ADMIN','LAB_STAFF')")
    @ResponseStatus(HttpStatus.CREATED)
    public TestResponse addTest(@Valid @RequestBody TestRequest r) {
        return service.addTest(r);
    }

    @PostMapping("/requests")
    @PreAuthorize("hasAnyRole('ADMIN','DOCTOR')")
    @ResponseStatus(HttpStatus.CREATED)
    public LabRequestResponse request(@Valid @RequestBody LabRequestCreate r) {
        return service.request(r);
    }

    @GetMapping("/requests")
    @PreAuthorize("hasAnyRole('ADMIN','DOCTOR','LAB_STAFF')")
    public PageResponse<LabRequestResponse> queue(@RequestParam(required = false) LabStatus status,
                                                  @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return PageResponse.of(service.queue(status, page, size));
    }

    @GetMapping("/requests/{id}")
    public LabRequestResponse get(@PathVariable Long id) {
        return service.get(id);
    }

    @GetMapping("/requests/patient/{patientId}")
    public List<LabRequestResponse> forPatient(@PathVariable Long patientId) {
        return service.forPatient(patientId);
    }

    @PutMapping("/requests/{id}/status")
    @PreAuthorize("hasAnyRole('ADMIN','LAB_STAFF')")
    public LabRequestResponse status(@PathVariable Long id, @Valid @RequestBody StatusUpdate r) {
        return service.updateStatus(id, r.getStatus());
    }

    @PutMapping("/requests/{id}/cancel")
    @PreAuthorize("hasAnyRole('ADMIN','DOCTOR','LAB_STAFF')")
    public LabRequestResponse cancel(@PathVariable Long id) {
        return service.cancel(id);
    }

    @PostMapping("/requests/{id}/report")
    @PreAuthorize("hasAnyRole('ADMIN','LAB_STAFF')")
    @ResponseStatus(HttpStatus.CREATED)
    public ReportResponse submitReport(@PathVariable Long id, @Valid @RequestBody ReportRequest r) {
        return service.submitReport(id, r);
    }

    @GetMapping("/requests/{id}/report")
    public ReportResponse report(@PathVariable Long id) {
        return service.report(id);
    }
}
