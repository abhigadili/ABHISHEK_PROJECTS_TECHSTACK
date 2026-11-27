package com.hospital.records.web;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import com.hospital.common.web.PageResponse;
import com.hospital.records.domain.EntryType;
import com.hospital.records.dto.RecordDtos.*;
import com.hospital.records.service.RecordService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/records")
public class RecordController {
    private final RecordService service;

    public RecordController(RecordService service) {
        this.service = service;
    }

    @PostMapping("/entries")
    @PreAuthorize("hasAnyRole('ADMIN','DOCTOR')")
    @ResponseStatus(HttpStatus.CREATED)
    public EntryResponse add(@Valid @RequestBody EntryRequest r) {
        return service.addEntry(r);
    }

    @PutMapping("/entries/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','DOCTOR')")
    public EntryResponse update(@PathVariable Long id, @Valid @RequestBody EntryUpdateRequest r) {
        return service.updateEntry(id, r);
    }

    @GetMapping("/entries/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','DOCTOR','PATIENT')")
    public EntryResponse entry(@PathVariable Long id) {
        return service.entry(id);
    }

    @GetMapping("/patients/{patientId}/entries")
    @PreAuthorize("hasAnyRole('ADMIN','DOCTOR','PATIENT')")
    public PageResponse<EntryResponse> timeline(@PathVariable Long patientId, @RequestParam(required = false) EntryType type,
                                                @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return PageResponse.of(service.timeline(patientId, type, page, size));
    }

    @GetMapping("/patients/{patientId}/summary")
    @PreAuthorize("hasAnyRole('ADMIN','DOCTOR','PATIENT')")
    public SummaryResponse summary(@PathVariable Long patientId) {
        return service.summary(patientId);
    }

    @PutMapping("/patients/{patientId}/conditions")
    @PreAuthorize("hasAnyRole('ADMIN','DOCTOR')")
    public void conditions(@PathVariable Long patientId, @Valid @RequestBody ConditionsRequest r) {
        service.updateConditions(patientId, r.getChronicConditions());
    }
}
