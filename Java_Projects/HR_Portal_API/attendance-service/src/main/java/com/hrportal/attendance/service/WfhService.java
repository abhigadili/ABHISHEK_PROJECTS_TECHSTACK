package com.hrportal.attendance.service;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hrportal.attendance.dto.AttendanceDtos.WfhCreateRequest;
import com.hrportal.attendance.dto.AttendanceDtos.WfhResponse;
import com.hrportal.attendance.entity.AttendanceEmployee;
import com.hrportal.attendance.entity.Enums.RequestStatus;
import com.hrportal.attendance.entity.WfhRequest;
import com.hrportal.attendance.producer.AttendanceEventProducer;
import com.hrportal.attendance.repository.AttendanceRepositories.AttendanceEmployeeRepository;
import com.hrportal.attendance.repository.AttendanceRepositories.WfhRepository;
import com.hrportal.common.audit.AuditService;
import com.hrportal.common.exception.BadRequestException;
import com.hrportal.common.exception.ConflictException;
import com.hrportal.common.exception.ForbiddenOperationException;
import com.hrportal.common.exception.ResourceNotFoundException;
import com.hrportal.common.persistence.BeanMapper;
import com.hrportal.common.security.CurrentUser;

/** Work-from-home requests: employee asks, manager (or HR) decides; an approved request lets the employee check in as WFH. */
@Service
public class WfhService {
    private final WfhRepository requests;
    private final AttendanceEmployeeRepository employees;
    private final AttendanceEventProducer producer;
    private final AttendanceService attendance;
    private final AuditService audit;

    public WfhService(WfhRepository requests, AttendanceEmployeeRepository employees, AttendanceEventProducer producer, AttendanceService attendance, AuditService audit) {
        this.requests = requests;
        this.employees = employees;
        this.producer = producer;
        this.attendance = attendance;
        this.audit = audit;
    }

    @Transactional
    public WfhResponse create(WfhCreateRequest req) {
        String me = CurrentUser.employeeId();
        if (me == null) throw new ForbiddenOperationException("Your account is not linked to an employee record");
        if (req.fromDate().isBefore(attendance.today())) throw new BadRequestException("Work-from-home cannot start in the past");
        if (req.fromDate().plusDays(14).isBefore(req.toDate())) throw new BadRequestException("A single request can cover at most 15 days");
        if (requests.existsOverlap(me, req.fromDate(), req.toDate())) throw new ConflictException("An open or approved request already covers these dates");
        AttendanceEmployee emp = employees.findById(me).orElse(null);
        WfhRequest w = new WfhRequest();
        w.setEmployeeId(me);
        w.setEmployeeName(emp == null ? null : emp.getFullName());
        w.setFromDate(req.fromDate());
        w.setToDate(req.toDate());
        w.setReason(req.reason());
        w.setManagerId(emp == null ? null : emp.getManagerId());
        w = requests.save(w);
        if (w.getManagerId() != null) {
            producer.notify(w.getManagerId(), "WFH_REQUESTED", w.getId(), Map.of("employeeName", String.valueOf(w.getEmployeeName()), "from", w.getFromDate().toString(), "to", w.getToDate().toString()), "wfh-req:" + w.getId());
        }
        audit.record("WfhRequest", w.getId(), "REQUESTED", w.getFromDate() + ".." + w.getToDate());
        return toResponse(w);
    }

    @Transactional
    public WfhResponse decide(String id, boolean approve, String comment) {
        WfhRequest w = requests.findById(id).orElseThrow(() -> ResourceNotFoundException.of("Work-from-home request", id));
        if (w.getStatus() != RequestStatus.PENDING) throw new BadRequestException("Request is already " + w.getStatus());
        String me = CurrentUser.employeeId();
        if (w.getEmployeeId().equals(me)) throw new ForbiddenOperationException("You cannot review your own request");
        if (!CurrentUser.isHr() && (me == null || !me.equals(w.getManagerId()))) throw new ForbiddenOperationException("Only the manager (or HR) can review this request");
        w.setStatus(approve ? RequestStatus.APPROVED : RequestStatus.REJECTED);
        w.setReviewerId(me);
        w.setReviewComment(comment);
        w.setReviewedAt(Instant.now());
        requests.save(w);
        String tpl = approve ? "WFH_APPROVED" : "WFH_REJECTED";
        producer.notify(w.getEmployeeId(), tpl, w.getId(), Map.of("from", w.getFromDate().toString(), "to", w.getToDate().toString(), "comment", comment == null ? "" : comment), tpl + ":" + w.getId());
        audit.record("WfhRequest", id, approve ? "APPROVED" : "REJECTED", comment);
        return toResponse(w);
    }

    @Transactional
    public WfhResponse cancel(String id) {
        WfhRequest w = requests.findById(id).orElseThrow(() -> ResourceNotFoundException.of("Work-from-home request", id));
        if (!w.getEmployeeId().equals(CurrentUser.employeeId())) throw new ForbiddenOperationException("Only the requester can cancel");
        if (w.getStatus() == RequestStatus.REJECTED || w.getStatus() == RequestStatus.CANCELLED) throw new BadRequestException("Request is already " + w.getStatus());
        if (w.getToDate().isBefore(LocalDate.now())) throw new BadRequestException("The request period is over");
        w.setStatus(RequestStatus.CANCELLED);
        return toResponse(requests.save(w));
    }

    @Transactional(readOnly = true)
    public List<WfhResponse> mine() {
        return BeanMapper.toRecords(requests.findByEmployeeIdOrderByCreatedAtDesc(CurrentUser.employeeId()), WfhResponse.class);
    }

    @Transactional(readOnly = true)
    public List<WfhResponse> pending() {
        List<WfhRequest> list = CurrentUser.isHr() ? requests.findByStatusOrderByCreatedAtAsc(RequestStatus.PENDING)
                : requests.findByStatusAndManagerIdOrderByCreatedAtAsc(RequestStatus.PENDING, String.valueOf(CurrentUser.employeeId()));
        return BeanMapper.toRecords(list, WfhResponse.class);
    }

    private WfhResponse toResponse(WfhRequest w) {
        return BeanMapper.toRecord(w, WfhResponse.class);
    }
}
