package com.hrportal.attendance.service;

import java.time.LocalDate;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hrportal.attendance.dto.AttendanceDtos.AssignmentRequest;
import com.hrportal.attendance.dto.AttendanceDtos.AssignmentResponse;
import com.hrportal.attendance.dto.AttendanceDtos.ShiftRequest;
import com.hrportal.attendance.dto.AttendanceDtos.ShiftResponse;
import com.hrportal.attendance.entity.Shift;
import com.hrportal.attendance.entity.ShiftAssignment;
import com.hrportal.attendance.repository.AttendanceRepositories.ShiftAssignmentRepository;
import com.hrportal.attendance.repository.AttendanceRepositories.ShiftRepository;
import com.hrportal.common.audit.AuditService;
import com.hrportal.common.exception.BadRequestException;
import com.hrportal.common.exception.ConflictException;
import com.hrportal.common.persistence.BeanMapper;
import com.hrportal.common.persistence.CrudService;

/** Shift management and shift assignment (employee -> shift for a period). */
@Service
public class ShiftService extends CrudService<Shift, ShiftRequest, ShiftResponse> {
    private final ShiftRepository shifts;
    private final ShiftAssignmentRepository assignments;

    public ShiftService(ShiftRepository shifts, ShiftAssignmentRepository assignments, AuditService audit) {
        super(shifts, audit, Shift.class, ShiftResponse.class);
        this.shifts = shifts;
        this.assignments = assignments;
    }

    @Override
    protected void beforeCreate(Shift s, ShiftRequest r) {
        if (shifts.findByCodeIgnoreCase(r.code()).isPresent()) throw new ConflictException("Shift code already exists: " + r.code());
        validate(s);
        singleDefault(s);
    }

    @Override
    protected void beforeUpdate(Shift s, ShiftRequest r) {
        validate(s);
        singleDefault(s);
    }

    private void validate(Shift s) {
        if (s.getHalfDayMinutes() > s.getFullDayMinutes()) throw new BadRequestException("halfDayMinutes cannot exceed fullDayMinutes");
        if (s.getFullDayMinutes() > s.getStandardMinutes()) throw new BadRequestException("fullDayMinutes cannot exceed standardMinutes");
    }

    private void singleDefault(Shift s) {
        if (!s.isDefaultShift()) return;
        shifts.findAll().stream().filter(x -> x.isDefaultShift() && !x.getId().equals(s.getId())).forEach(x -> {
            x.setDefaultShift(false);
            shifts.save(x);
        });
    }

    /** The shift in force for an employee on a date: assignment first, then the default shift. */
    @Transactional(readOnly = true)
    public Shift shiftFor(String employeeId, LocalDate date) {
        return assignments.findInForce(employeeId, date).stream().findFirst()
                .flatMap(a -> shifts.findById(a.getShiftId()))
                .or(shifts::findFirstByDefaultShiftTrueAndActiveTrue)
                .orElseThrow(() -> new BadRequestException("No shift configured (create a default shift first)"));
    }

    @Transactional
    public AssignmentResponse assign(String shiftId, AssignmentRequest req) {
        find(shiftId);
        if (req.effectiveTo() != null && req.effectiveTo().isBefore(req.effectiveFrom())) throw new BadRequestException("effectiveTo must not be before effectiveFrom");
        LocalDate to = req.effectiveTo() == null ? LocalDate.of(9999, 12, 31) : req.effectiveTo();
        if (assignments.existsOverlap(req.employeeId(), req.effectiveFrom(), to)) throw new ConflictException("The employee already has a shift assigned for part of this period");
        ShiftAssignment a = new ShiftAssignment();
        a.setEmployeeId(req.employeeId());
        a.setShiftId(shiftId);
        a.setEffectiveFrom(req.effectiveFrom());
        a.setEffectiveTo(req.effectiveTo());
        a = assignments.save(a);
        audit.record("ShiftAssignment", a.getId(), "ASSIGNED", BeanMapper.toRecord(a, AssignmentResponse.class));
        return BeanMapper.toRecord(a, AssignmentResponse.class);
    }

    @Transactional(readOnly = true)
    public List<AssignmentResponse> assignmentsOf(String employeeId) {
        return BeanMapper.toRecords(assignments.findByEmployeeIdOrderByEffectiveFromDesc(employeeId), AssignmentResponse.class);
    }
}
