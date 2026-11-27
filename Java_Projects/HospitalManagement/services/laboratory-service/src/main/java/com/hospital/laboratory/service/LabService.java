package com.hospital.laboratory.service;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hospital.common.client.DoctorGateway;
import com.hospital.common.client.DoctorView;
import com.hospital.common.client.PatientGateway;
import com.hospital.common.client.PatientSummary;
import com.hospital.common.events.LabReportGeneratedEvent;
import com.hospital.common.events.LabTestRequestedEvent;
import com.hospital.common.events.Topics;
import com.hospital.common.kafka.EventPublisher;
import com.hospital.common.security.CurrentUser;
import com.hospital.common.security.Role;
import com.hospital.common.web.BadRequestException;
import com.hospital.common.web.ConflictException;
import com.hospital.common.web.ForbiddenOperationException;
import com.hospital.common.web.ResourceNotFoundException;
import com.hospital.laboratory.domain.*;
import com.hospital.laboratory.dto.LabDtos.*;

import lombok.extern.log4j.Log4j2;

@Log4j2
@Service
public class LabService {
    /** Allowed forward transitions of a request driven by laboratory staff. */
    private static final Map<LabStatus, Set<LabStatus>> TRANSITIONS = Map.of(
            LabStatus.REQUESTED, Set.of(LabStatus.SAMPLE_COLLECTED, LabStatus.CANCELLED),
            LabStatus.SAMPLE_COLLECTED, Set.of(LabStatus.IN_PROGRESS, LabStatus.CANCELLED),
            LabStatus.IN_PROGRESS, Set.of(LabStatus.CANCELLED));

    private final LabTestRepository tests;
    private final LabRequestRepository requests;
    private final LabReportRepository reports;
    private final PatientGateway patients;    // OpenFeign
    private final DoctorGateway doctors;      // WebClient
    private final EventPublisher events;

    public LabService(LabTestRepository tests, LabRequestRepository requests, LabReportRepository reports, PatientGateway patients,
                      DoctorGateway doctors, EventPublisher events) {
        this.tests = tests;
        this.requests = requests;
        this.reports = reports;
        this.patients = patients;
        this.doctors = doctors;
        this.events = events;
    }

    // ---- catalogue -----------------------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<TestResponse> catalogue() {
        return tests.findByActiveTrueOrderByName().stream().map(TestResponse::from).toList();
    }

    @Transactional
    public TestResponse addTest(TestRequest r) {
        if (tests.existsByCode(r.getCode())) throw new ConflictException("Test code '" + r.getCode() + "' already exists");
        LabTest t = new LabTest();
        t.setCode(r.getCode().trim().toUpperCase());
        t.setName(r.getName());
        t.setSampleType(r.getSampleType());
        t.setPrice(r.getPrice());
        t.setTurnaroundHours(r.getTurnaroundHours());
        return TestResponse.from(tests.save(t));
    }

    // ---- Scenario 4 ----------------------------------------------------------------------------------------

    @Transactional
    public LabRequestResponse request(LabRequestCreate c) {
        PatientSummary patient = patients.summary(c.getPatientId());
        DoctorView doctor = doctors.doctor(c.getDoctorId());
        if (!doctor.isActive()) throw new BadRequestException("Doctor " + doctor.getId() + " is not active");
        if (!CurrentUser.isAdmin() && (doctor.getUserId() == null || !doctor.getUserId().equals(CurrentUser.id()))) {
            throw new ForbiddenOperationException("A doctor can only request tests in their own name");
        }
        LabTest test = tests.findByCode(c.getTestCode().trim().toUpperCase()).filter(LabTest::isActive)
                .orElseThrow(() -> new BadRequestException("Unknown or inactive lab test '" + c.getTestCode() + "'"));
        LabRequest r = new LabRequest();
        r.setPatientId(patient.getId());
        r.setPatientName(patient.getFullName());
        r.setPatientEmail(patient.getEmail());
        r.setDoctorId(doctor.getId());
        r.setAppointmentId(c.getAppointmentId());
        r.setTest(test);
        r.setTestName(test.getName());
        r.setPrice(test.getPrice());
        r.setPriority(c.getPriority() == null ? LabPriority.ROUTINE : c.getPriority());
        r.setClinicalNotes(c.getClinicalNotes());
        r = requests.save(r);
        events.publish(Topics.LAB_TEST_REQUESTED, String.valueOf(r.getId()), new LabTestRequestedEvent(EventPublisher.newId(), EventPublisher.now(),
                r.getId(), r.getPatientId(), r.getPatientName(), r.getPatientEmail(), r.getDoctorId(), test.getCode(), test.getName(), r.getPrice(), r.getPriority().name()));
        log.info("Lab request {} ({}) created for patient {}", r.getId(), test.getCode(), r.getPatientId());
        return LabRequestResponse.from(r);
    }

    @Transactional
    public LabRequestResponse updateStatus(Long id, LabStatus target) {
        LabRequest r = find(id);
        if (target == LabStatus.COMPLETED) throw new BadRequestException("A request becomes COMPLETED only when its report is submitted");
        if (!TRANSITIONS.getOrDefault(r.getStatus(), Set.of()).contains(target)) {
            throw new ConflictException("Invalid status change " + r.getStatus() + " -> " + target);
        }
        r.setStatus(target);
        return LabRequestResponse.from(r);
    }

    @Transactional
    public LabRequestResponse cancel(Long id) {
        LabRequest r = find(id);
        if (r.getStatus() != LabStatus.REQUESTED && r.getStatus() != LabStatus.SAMPLE_COLLECTED) {
            throw new ConflictException("Only REQUESTED or SAMPLE_COLLECTED requests can be cancelled (current: " + r.getStatus() + ")");
        }
        r.setStatus(LabStatus.CANCELLED);
        return LabRequestResponse.from(r);
    }

    @Transactional
    public ReportResponse submitReport(Long requestId, ReportRequest rr) {
        LabRequest r = find(requestId);
        if (r.getStatus() != LabStatus.IN_PROGRESS) throw new ConflictException("A report can only be submitted for IN_PROGRESS requests (current: " + r.getStatus() + ")");
        if (reports.existsByRequestId(requestId)) throw new ConflictException("A report already exists for this request");
        LabReport rep = new LabReport();
        rep.setRequest(r);
        rep.setResultSummary(rr.getResultSummary());
        rep.setResultDetails(rr.getResultDetails());
        rep.setReferenceRange(rr.getReferenceRange());
        rep.setAbnormal(rr.isAbnormal());
        rep.setReportedBy(CurrentUser.username() == null ? "system" : CurrentUser.username());
        rep = reports.save(rep);
        r.setStatus(LabStatus.COMPLETED);
        events.publish(Topics.LAB_REPORT_GENERATED, String.valueOf(rep.getId()), new LabReportGeneratedEvent(EventPublisher.newId(), EventPublisher.now(),
                rep.getId(), r.getId(), r.getPatientId(), r.getPatientName(), r.getPatientEmail(), r.getDoctorId(), r.getTestName(), rep.getResultSummary(), rep.isAbnormal()));
        log.info("Lab report {} generated for request {}", rep.getId(), r.getId());
        return ReportResponse.from(rep);
    }

    // ---- reads ---------------------------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public LabRequestResponse get(Long id) {
        LabRequest r = find(id);
        patientGuard(r.getPatientId());
        return LabRequestResponse.from(r);
    }

    @Transactional(readOnly = true)
    public ReportResponse report(Long requestId) {
        LabRequest r = find(requestId);
        patientGuard(r.getPatientId());
        return ReportResponse.from(reports.findByRequestId(requestId).orElseThrow(() -> new ResourceNotFoundException("No report available yet for request " + requestId + " (status " + r.getStatus() + ")")));
    }

    @Transactional(readOnly = true)
    public List<LabRequestResponse> forPatient(Long patientId) {
        patients.requireAccess(patientId);
        return requests.findByPatientIdOrderByRequestedAtDesc(patientId).stream().map(LabRequestResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public Page<LabRequestResponse> queue(LabStatus status, int page, int size) {
        PageRequest pr = PageRequest.of(page, Math.min(size, 100), Sort.by(Sort.Direction.DESC, "priority").and(Sort.by("requestedAt")));
        return (status == null ? requests.findAll(pr) : requests.findByStatus(status, pr)).map(LabRequestResponse::from);
    }

    // ---- Kafka-driven background step ---------------------------------------------------------------------

    /** Consumer of LabTestRequested: puts the request in the lab work queue by assigning an accession number. */
    @Transactional
    public void enqueue(Long requestId) {
        requests.findById(requestId).ifPresent(r -> {
            if (r.getAccessionNumber() == null) {
                r.setAccessionNumber("LAB-" + LocalDate.now().toString().replace("-", "") + "-" + String.format("%06d", r.getId()));
                r.setQueuedAt(EventPublisher.now());
                log.info("Lab request {} queued with accession {}", r.getId(), r.getAccessionNumber());
            }
        });
    }

    private void patientGuard(Long patientId) {
        if (CurrentUser.hasRole(Role.PATIENT)) patients.requireAccess(patientId);
    }

    private LabRequest find(Long id) {
        return requests.findById(id).orElseThrow(() -> new ResourceNotFoundException("Lab request " + id + " not found"));
    }
}
