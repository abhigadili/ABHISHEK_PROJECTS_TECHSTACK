package com.hospital.prescription.service;

import java.time.LocalDate;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hospital.common.client.DoctorGateway;
import com.hospital.common.client.DoctorView;
import com.hospital.common.client.PatientGateway;
import com.hospital.common.client.PatientSummary;
import com.hospital.common.events.MedicineDispensedEvent;
import com.hospital.common.events.PrescriptionCreatedEvent;
import com.hospital.common.events.Topics;
import com.hospital.common.kafka.EventPublisher;
import com.hospital.common.security.CurrentUser;
import com.hospital.common.security.Role;
import com.hospital.common.web.BadRequestException;
import com.hospital.common.web.ConflictException;
import com.hospital.common.web.ForbiddenOperationException;
import com.hospital.common.web.ResourceNotFoundException;
import com.hospital.prescription.domain.*;
import com.hospital.prescription.dto.PrescriptionDtos.*;

import lombok.extern.log4j.Log4j2;

@Log4j2
@Service
public class PrescriptionService {
    private final PrescriptionRepository prescriptions;
    private final PatientGateway patients;    // OpenFeign
    private final DoctorGateway doctors;      // WebClient
    private final EventPublisher events;
    private final int defaultValidityDays;

    public PrescriptionService(PrescriptionRepository prescriptions, PatientGateway patients, DoctorGateway doctors, EventPublisher events,
                               @Value("${hospital.prescription.default-validity-days:30}") int defaultValidityDays) {
        this.prescriptions = prescriptions;
        this.patients = patients;
        this.doctors = doctors;
        this.events = events;
        this.defaultValidityDays = defaultValidityDays;
    }

    @Transactional
    public PrescriptionResponse create(PrescriptionRequest r) {
        PatientSummary patient = patients.summary(r.getPatientId());
        if (!"ACTIVE".equals(patient.getStatus())) throw new BadRequestException("Patient " + patient.getId() + " is not active");
        DoctorView doctor = doctors.doctor(r.getDoctorId());
        if (!doctor.isActive()) throw new BadRequestException("Doctor " + doctor.getId() + " is not active");
        if (!CurrentUser.isAdmin() && (doctor.getUserId() == null || !doctor.getUserId().equals(CurrentUser.id()))) {
            throw new ForbiddenOperationException("A doctor can only issue prescriptions in their own name");
        }
        Prescription p = new Prescription();
        p.setPatientId(patient.getId());
        p.setPatientName(patient.getFullName());
        p.setPatientEmail(patient.getEmail());
        p.setDoctorId(doctor.getId());
        p.setDoctorName(doctor.getFullName());
        p.setAppointmentId(r.getAppointmentId());
        p.setDiagnosis(r.getDiagnosis());
        p.setNotes(r.getNotes());
        p.setValidUntil(LocalDate.now().plusDays(r.getValidDays() == null ? defaultValidityDays : r.getValidDays()));
        for (ItemRequest i : r.getItems()) {
            PrescriptionItem item = new PrescriptionItem();
            item.setMedicineName(i.getMedicineName().trim());
            item.setDosage(i.getDosage());
            item.setFrequency(i.getFrequency());
            item.setDurationDays(i.getDurationDays());
            item.setQuantity(i.getQuantity());
            item.setInstructions(i.getInstructions());
            p.addItem(item);
        }
        p = prescriptions.save(p);
        List<PrescriptionCreatedEvent.Item> items = p.getItems().stream()
                .map(i -> new PrescriptionCreatedEvent.Item(i.getMedicineName(), i.getDosage(), i.getFrequency(), i.getDurationDays(), i.getQuantity())).toList();
        events.publish(Topics.PRESCRIPTION_CREATED, String.valueOf(p.getId()), new PrescriptionCreatedEvent(EventPublisher.newId(), EventPublisher.now(),
                p.getId(), p.getPatientId(), p.getPatientName(), p.getPatientEmail(), p.getDoctorId(), p.getDoctorName(), p.getValidUntil(), p.getDiagnosis(), items));
        log.info("Prescription {} created for patient {} by doctor {}", p.getId(), p.getPatientId(), p.getDoctorId());
        return PrescriptionResponse.from(p);
    }

    @Transactional(readOnly = true)
    public PrescriptionResponse get(Long id) {
        Prescription p = find(id);
        if (CurrentUser.hasRole(Role.PATIENT)) patients.requireAccess(p.getPatientId());
        return PrescriptionResponse.from(p);
    }

    @Transactional(readOnly = true)
    public StatusResponse status(Long id) {
        Prescription p = find(id);
        if (CurrentUser.hasRole(Role.PATIENT)) patients.requireAccess(p.getPatientId());
        return new StatusResponse(p.getId(), p.getStatus(), p.getStatusChangedAt());
    }

    @Transactional(readOnly = true)
    public List<PrescriptionResponse> forPatient(Long patientId) {
        patients.requireAccess(patientId);
        return prescriptions.findByPatient(patientId).stream().map(PrescriptionResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<PrescriptionResponse> forDoctor(Long doctorId) {
        return prescriptions.findByDoctor(doctorId).stream().map(PrescriptionResponse::from).toList();
    }

    @Transactional
    public StatusResponse cancel(Long id) {
        Prescription p = find(id);
        if (!CurrentUser.isAdmin()) {
            DoctorView d = doctors.doctor(p.getDoctorId());
            if (d.getUserId() == null || !d.getUserId().equals(CurrentUser.id())) throw new ForbiddenOperationException("Only the prescribing doctor can cancel this prescription");
        }
        if (p.getStatus() != PrescriptionStatus.ACTIVE) throw new ConflictException("Only ACTIVE prescriptions can be cancelled (current: " + p.getStatus() + ")");
        setStatus(p, PrescriptionStatus.CANCELLED);
        return new StatusResponse(p.getId(), p.getStatus(), p.getStatusChangedAt());
    }

    /** Consumer of MedicineDispensed (from Pharmacy). */
    @Transactional
    public void markDispensed(MedicineDispensedEvent e) {
        prescriptions.findById(e.prescriptionId()).ifPresentOrElse(p -> {
            if (p.getStatus() == PrescriptionStatus.ACTIVE) setStatus(p, PrescriptionStatus.DISPENSED);
        }, () -> log.warn("MedicineDispensed for unknown prescription {}", e.prescriptionId()));
    }

    @Transactional
    public int expireOverdue() {
        List<Prescription> overdue = prescriptions.findByStatusAndValidUntilBefore(PrescriptionStatus.ACTIVE, LocalDate.now());
        overdue.forEach(p -> setStatus(p, PrescriptionStatus.EXPIRED));
        return overdue.size();
    }

    private void setStatus(Prescription p, PrescriptionStatus s) {
        p.setStatus(s);
        p.setStatusChangedAt(EventPublisher.now());
    }

    private Prescription find(Long id) {
        return prescriptions.findWithItems(id).orElseThrow(() -> new ResourceNotFoundException("Prescription " + id + " not found"));
    }
}
