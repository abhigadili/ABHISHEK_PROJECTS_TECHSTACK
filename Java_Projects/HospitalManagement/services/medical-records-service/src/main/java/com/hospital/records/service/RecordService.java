package com.hospital.records.service;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hospital.common.client.PatientGateway;
import com.hospital.common.client.PatientSummary;
import com.hospital.common.web.ResourceNotFoundException;
import com.hospital.records.domain.*;
import com.hospital.records.dto.RecordDtos.*;

import lombok.extern.log4j.Log4j2;

@Log4j2
@Service
public class RecordService {
    private final PatientRecordRepository records;
    private final RecordEntryRepository entries;
    private final PatientGateway patients;   // OpenFeign + circuit breaker

    public RecordService(PatientRecordRepository records, RecordEntryRepository entries, PatientGateway patients) {
        this.records = records;
        this.entries = entries;
        this.patients = patients;
    }

    // ---- manual entries by doctors -------------------------------------------------------------------------

    @Transactional
    public EntryResponse addEntry(EntryRequest r) {
        PatientSummary p = patients.summary(r.getPatientId());
        PatientRecord rec = ensureRecord(p.getId(), p.getFullName());
        RecordEntry e = new RecordEntry();
        e.setRecord(rec);
        e.setPatientId(p.getId());
        e.setEntryType(r.getEntryType());
        e.setTitle(r.getTitle());
        e.setDetails(r.getDetails());
        e.setDoctorId(r.getDoctorId());
        return EntryResponse.from(entries.save(e));
    }

    @Transactional
    public EntryResponse updateEntry(Long id, EntryUpdateRequest r) {
        RecordEntry e = entries.findById(id).orElseThrow(() -> new ResourceNotFoundException("Entry " + id + " not found"));
        if (!"MANUAL".equals(e.getSource())) throw new com.hospital.common.web.ConflictException("System-generated entries cannot be edited");
        e.setTitle(r.getTitle());
        e.setDetails(r.getDetails());
        return EntryResponse.from(e);
    }

    @Transactional
    public void updateConditions(Long patientId, String conditions) {
        PatientSummary p = patients.summary(patientId);
        ensureRecord(p.getId(), p.getFullName()).setChronicConditions(conditions);
    }

    // ---- reads ---------------------------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public Page<EntryResponse> timeline(Long patientId, EntryType type, int page, int size) {
        patients.requireAccess(patientId);     // staff, or the patient themself
        PageRequest pr = PageRequest.of(page, Math.min(size, 100), Sort.by(Sort.Direction.DESC, "recordedAt", "id"));
        return (type == null ? entries.findByPatientId(patientId, pr) : entries.findByPatientIdAndEntryType(patientId, type, pr)).map(EntryResponse::from);
    }

    @Transactional(readOnly = true)
    public EntryResponse entry(Long id) {
        RecordEntry e = entries.findById(id).orElseThrow(() -> new ResourceNotFoundException("Entry " + id + " not found"));
        patients.requireAccess(e.getPatientId());
        return EntryResponse.from(e);
    }

    @Transactional(readOnly = true)
    public SummaryResponse summary(Long patientId) {
        patients.requireAccess(patientId);
        PatientRecord rec = records.findByPatientId(patientId).orElseThrow(() -> new ResourceNotFoundException("No medical record exists yet for patient " + patientId));
        Map<EntryType, Long> counts = new EnumMap<>(EntryType.class);
        for (EntryType t : EntryType.values()) counts.put(t, entries.countByPatientIdAndEntryType(patientId, t));
        List<EntryResponse> latest = entries.findTop5ByPatientIdOrderByRecordedAtDesc(patientId).stream().map(EntryResponse::from).toList();
        return SummaryResponse.of(rec, counts, latest);
    }

    // ---- event-driven writes (Kafka consumers) -------------------------------------------------------------

    @Transactional
    public void initRecord(Long patientId, String name) {
        ensureRecord(patientId, name);
    }

    /** Adds a system entry once per (type, source reference) so redelivered events never duplicate the timeline. */
    @Transactional
    public void addSystemEntry(Long patientId, String patientName, EntryType type, String title, String details, Long doctorId,
                               String referenceType, Long referenceId) {
        if (entries.existsByEntryTypeAndReferenceTypeAndReferenceId(type, referenceType, referenceId)) return;
        RecordEntry e = new RecordEntry();
        e.setRecord(ensureRecord(patientId, patientName == null ? "Patient " + patientId : patientName));
        e.setPatientId(patientId);
        e.setEntryType(type);
        e.setTitle(title);
        e.setDetails(details);
        e.setDoctorId(doctorId);
        e.setReferenceType(referenceType);
        e.setReferenceId(referenceId);
        e.setSource("EVENT");
        entries.save(e);
        log.info("Timeline entry {} added for patient {} ({} #{})", type, patientId, referenceType, referenceId);
    }

    private PatientRecord ensureRecord(Long patientId, String name) {
        return records.findByPatientId(patientId).orElseGet(() -> {
            PatientRecord r = new PatientRecord();
            r.setPatientId(patientId);
            r.setPatientName(name);
            return records.save(r);
        });
    }
}
