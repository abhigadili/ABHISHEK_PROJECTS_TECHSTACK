package com.hrportal.attendance.service;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.PriorityQueue;

import org.springframework.context.event.EventListener;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hrportal.attendance.dto.AttendanceDtos.CorrectionRequest;
import com.hrportal.attendance.dto.AttendanceDtos.CorrectionResponse;
import com.hrportal.attendance.entity.AttendanceCorrection;
import com.hrportal.attendance.entity.AttendanceEmployee;
import com.hrportal.attendance.entity.AttendanceRecord;
import com.hrportal.attendance.entity.Enums.RequestStatus;
import com.hrportal.attendance.entity.Enums.Source;
import com.hrportal.attendance.producer.AttendanceEventProducer;
import com.hrportal.attendance.queue.CorrectionEscalationQueue;
import com.hrportal.attendance.repository.AttendanceRepositories.AttendanceEmployeeRepository;
import com.hrportal.attendance.repository.AttendanceRepositories.AttendanceRecordRepository;
import com.hrportal.attendance.repository.AttendanceRepositories.CorrectionRepository;
import com.hrportal.common.audit.AuditService;
import com.hrportal.common.exception.BadRequestException;
import com.hrportal.common.exception.ConflictException;
import com.hrportal.common.exception.ForbiddenOperationException;
import com.hrportal.common.exception.ResourceNotFoundException;
import com.hrportal.common.persistence.BeanMapper;
import com.hrportal.common.security.CurrentUser;

/** Attendance correction / regularization: request -> manager (or HR) review -> record rewritten, event + notification. */
@Service
public class CorrectionService {
    private static final int MAX_BACKDATE_DAYS = 31;

    private final CorrectionRepository corrections;
    private final AttendanceRecordRepository records;
    private final AttendanceEmployeeRepository employees;
    private final AttendanceService attendance;
    private final ShiftService shifts;
    private final AttendanceEventProducer producer;
    private final CorrectionEscalationQueue escalation;
    private final AuditService audit;

    public CorrectionService(CorrectionRepository corrections, AttendanceRecordRepository records, AttendanceEmployeeRepository employees,
                             AttendanceService attendance, ShiftService shifts, AttendanceEventProducer producer, CorrectionEscalationQueue escalation,
                             AuditService audit) {
        this.corrections = corrections;
        this.records = records;
        this.employees = employees;
        this.attendance = attendance;
        this.shifts = shifts;
        this.producer = producer;
        this.escalation = escalation;
        this.audit = audit;
    }

    @Transactional
    public CorrectionResponse request(CorrectionRequest req) {
        String me = requireEmployee();
        LocalDate today = attendance.today();
        if (req.workDate().isAfter(today)) throw new BadRequestException("Cannot correct a future date");
        if (req.workDate().isBefore(today.minusDays(MAX_BACKDATE_DAYS))) throw new BadRequestException("Corrections are limited to the last " + MAX_BACKDATE_DAYS + " days");
        if (corrections.existsByEmployeeIdAndWorkDateAndStatus(me, req.workDate(), RequestStatus.PENDING)) throw new ConflictException("A correction for this date is already pending");
        AttendanceEmployee emp = employees.findById(me).orElse(null);
        AttendanceCorrection c = new AttendanceCorrection();
        c.setEmployeeId(me);
        c.setEmployeeName(emp == null ? null : emp.getFullName());
        c.setWorkDate(req.workDate());
        c.setRequestedCheckIn(req.checkIn());
        c.setRequestedCheckOut(req.checkOut());
        c.setReason(req.reason());
        c.setManagerId(emp == null ? null : emp.getManagerId());
        c = corrections.save(c);
        escalation.schedule(c.getId());
        if (c.getManagerId() != null) {
            producer.notify(c.getManagerId(), "CORRECTION_REQUESTED", c.getId(), Map.of("employeeName", String.valueOf(c.getEmployeeName()), "date", c.getWorkDate().toString(), "reason", c.getReason()), "corr-req:" + c.getId());
        }
        audit.record("AttendanceCorrection", c.getId(), "REQUESTED", c.getWorkDate() + " " + c.getReason());
        return toResponse(c);
    }

    @Transactional
    public CorrectionResponse approve(String id, String comment) {
        AttendanceCorrection c = find(id);
        authorise(c);
        AttendanceRecord r = records.findByEmployeeIdAndWorkDate(c.getEmployeeId(), c.getWorkDate()).orElseGet(AttendanceRecord::new);
        r.setEmployeeId(c.getEmployeeId());
        r.setWorkDate(c.getWorkDate());
        r.setCheckIn(c.getRequestedCheckIn());
        r.setCheckOut(c.getRequestedCheckOut());
        r.setSource(Source.CORRECTION);
        r.setRemarks("Corrected: " + c.getReason());
        attendance.recalculate(r, shifts.shiftFor(c.getEmployeeId(), c.getWorkDate()));
        r = records.save(r);
        c.setStatus(RequestStatus.APPROVED);
        c.setReviewerId(CurrentUser.employeeId());
        c.setReviewComment(comment);
        c.setReviewedAt(Instant.now());
        corrections.save(c);
        producer.corrected(r, CurrentUser.auditName(), c.getReason());
        producer.notify(c.getEmployeeId(), "CORRECTION_APPROVED", c.getId(), Map.of("date", c.getWorkDate().toString(), "comment", comment == null ? "" : comment), "corr-ok:" + c.getId());
        audit.record("AttendanceCorrection", id, "APPROVED", comment);
        return toResponse(c);
    }

    @Transactional
    public CorrectionResponse reject(String id, String comment) {
        AttendanceCorrection c = find(id);
        authorise(c);
        c.setStatus(RequestStatus.REJECTED);
        c.setReviewerId(CurrentUser.employeeId());
        c.setReviewComment(comment);
        c.setReviewedAt(Instant.now());
        corrections.save(c);
        producer.notify(c.getEmployeeId(), "CORRECTION_REJECTED", c.getId(), Map.of("date", c.getWorkDate().toString(), "comment", comment == null ? "" : comment), "corr-no:" + c.getId());
        audit.record("AttendanceCorrection", id, "REJECTED", comment);
        return toResponse(c);
    }

    @Transactional
    public CorrectionResponse cancel(String id) {
        AttendanceCorrection c = find(id);
        if (!c.getEmployeeId().equals(CurrentUser.employeeId())) throw new ForbiddenOperationException("Only the requester can cancel");
        if (c.getStatus() != RequestStatus.PENDING) throw new BadRequestException("Only a PENDING request can be cancelled");
        c.setStatus(RequestStatus.CANCELLED);
        return toResponse(corrections.save(c));
    }

    @Transactional(readOnly = true)
    public List<CorrectionResponse> mine() {
        return BeanMapper.toRecords(corrections.findByEmployeeIdOrderByCreatedAtDesc(requireEmployee()), CorrectionResponse.class);
    }

    /** Pending list ordered with a PriorityQueue: escalated requests first, then oldest first. */
    @Transactional(readOnly = true)
    public List<CorrectionResponse> pending() {
        List<AttendanceCorrection> source = CurrentUser.isHr() ? corrections.findByStatusOrderByCreatedAtAsc(RequestStatus.PENDING)
                : corrections.findByStatusAndManagerIdOrderByCreatedAtAsc(RequestStatus.PENDING, requireEmployee());
        PriorityQueue<AttendanceCorrection> pq = new PriorityQueue<>(Comparator.comparing(AttendanceCorrection::isEscalated).reversed()
                .thenComparing(AttendanceCorrection::getCreatedAt));
        pq.addAll(source);
        List<CorrectionResponse> out = new ArrayList<>();
        while (!pq.isEmpty()) out.add(toResponse(pq.poll()));
        return out;
    }

    /** Called by the DelayQueue worker: flag + remind the manager when nobody has reviewed in time. */
    @Transactional
    public void escalateIfStillPending(String id) {
        corrections.findById(id).filter(c -> c.getStatus() == RequestStatus.PENDING && !c.isEscalated()).ifPresent(c -> {
            c.setEscalated(true);
            corrections.save(c);
            if (c.getManagerId() != null) {
                producer.notify(c.getManagerId(), "CORRECTION_REMINDER", c.getId(), Map.of("employeeName", String.valueOf(c.getEmployeeName()), "date", c.getWorkDate().toString()), "corr-esc:" + c.getId());
            }
        });
    }

    /** Re-registers pending requests in the in-memory DelayQueue after a restart. */
    @EventListener(ApplicationReadyEvent.class)
    @Transactional(readOnly = true)
    public void rebuildQueue() {
        corrections.findByStatusOrderByCreatedAtAsc(RequestStatus.PENDING).stream().filter(c -> !c.isEscalated())
                .forEach(c -> escalation.scheduleAt(c.getId(), c.getCreatedAt().plus(java.time.Duration.ofHours(48))));
    }

    private void authorise(AttendanceCorrection c) {
        if (c.getStatus() != RequestStatus.PENDING) throw new BadRequestException("Request is already " + c.getStatus());
        String me = CurrentUser.employeeId();
        if (c.getEmployeeId().equals(me)) throw new ForbiddenOperationException("You cannot review your own correction");
        if (!CurrentUser.isHr() && (me == null || !me.equals(c.getManagerId()))) throw new ForbiddenOperationException("Only the manager (or HR) can review this request");
    }

    private AttendanceCorrection find(String id) {
        return corrections.findById(id).orElseThrow(() -> ResourceNotFoundException.of("Correction", id));
    }

    private static String requireEmployee() {
        String me = CurrentUser.employeeId();
        if (me == null) throw new ForbiddenOperationException("Your account is not linked to an employee record");
        return me;
    }

    private CorrectionResponse toResponse(AttendanceCorrection c) {
        return BeanMapper.toRecord(c, CorrectionResponse.class);
    }
}
