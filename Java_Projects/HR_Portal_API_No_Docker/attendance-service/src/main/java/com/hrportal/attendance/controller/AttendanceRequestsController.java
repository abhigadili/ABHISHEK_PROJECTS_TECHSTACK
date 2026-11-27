package com.hrportal.attendance.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.hrportal.attendance.dto.AttendanceDtos.AssignmentRequest;
import com.hrportal.attendance.dto.AttendanceDtos.AssignmentResponse;
import com.hrportal.attendance.dto.AttendanceDtos.CorrectionRequest;
import com.hrportal.attendance.dto.AttendanceDtos.CorrectionResponse;
import com.hrportal.attendance.dto.AttendanceDtos.DecisionRequest;
import com.hrportal.attendance.dto.AttendanceDtos.ShiftRequest;
import com.hrportal.attendance.dto.AttendanceDtos.ShiftResponse;
import com.hrportal.attendance.dto.AttendanceDtos.WfhCreateRequest;
import com.hrportal.attendance.dto.AttendanceDtos.WfhResponse;
import com.hrportal.attendance.service.CorrectionService;
import com.hrportal.attendance.service.ShiftService;
import com.hrportal.attendance.service.WfhService;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@Tag(name = "Attendance Requests and Shifts")
@RestController
@RequestMapping("/api/v1/attendance")
public class AttendanceRequestsController {
    private final CorrectionService corrections;
    private final WfhService wfh;
    private final ShiftService shifts;

    public AttendanceRequestsController(CorrectionService corrections, WfhService wfh, ShiftService shifts) {
        this.corrections = corrections;
        this.wfh = wfh;
        this.shifts = shifts;
    }

    // ---- corrections
    @PostMapping("/corrections")
    @ResponseStatus(HttpStatus.CREATED)
    public CorrectionResponse requestCorrection(@Valid @RequestBody CorrectionRequest req) {
        return corrections.request(req);
    }

    @GetMapping("/corrections/me")
    public List<CorrectionResponse> myCorrections() {
        return corrections.mine();
    }

    @GetMapping("/corrections/pending")
    @PreAuthorize("hasAuthority('PERM_ATTENDANCE_APPROVE')")
    public List<CorrectionResponse> pendingCorrections() {
        return corrections.pending();
    }

    @PostMapping("/corrections/{id}/approve")
    @PreAuthorize("hasAuthority('PERM_ATTENDANCE_APPROVE')")
    public CorrectionResponse approveCorrection(@PathVariable String id, @Valid @RequestBody(required = false) DecisionRequest req) {
        return corrections.approve(id, req == null ? null : req.comment());
    }

    @PostMapping("/corrections/{id}/reject")
    @PreAuthorize("hasAuthority('PERM_ATTENDANCE_APPROVE')")
    public CorrectionResponse rejectCorrection(@PathVariable String id, @Valid @RequestBody(required = false) DecisionRequest req) {
        return corrections.reject(id, req == null ? null : req.comment());
    }

    @PostMapping("/corrections/{id}/cancel")
    public CorrectionResponse cancelCorrection(@PathVariable String id) {
        return corrections.cancel(id);
    }

    // ---- work from home
    @PostMapping("/wfh")
    @ResponseStatus(HttpStatus.CREATED)
    public WfhResponse requestWfh(@Valid @RequestBody WfhCreateRequest req) {
        return wfh.create(req);
    }

    @GetMapping("/wfh/me")
    public List<WfhResponse> myWfh() {
        return wfh.mine();
    }

    @GetMapping("/wfh/pending")
    @PreAuthorize("hasAuthority('PERM_ATTENDANCE_APPROVE')")
    public List<WfhResponse> pendingWfh() {
        return wfh.pending();
    }

    @PostMapping("/wfh/{id}/approve")
    @PreAuthorize("hasAuthority('PERM_ATTENDANCE_APPROVE')")
    public WfhResponse approveWfh(@PathVariable String id, @Valid @RequestBody(required = false) DecisionRequest req) {
        return wfh.decide(id, true, req == null ? null : req.comment());
    }

    @PostMapping("/wfh/{id}/reject")
    @PreAuthorize("hasAuthority('PERM_ATTENDANCE_APPROVE')")
    public WfhResponse rejectWfh(@PathVariable String id, @Valid @RequestBody(required = false) DecisionRequest req) {
        return wfh.decide(id, false, req == null ? null : req.comment());
    }

    @PostMapping("/wfh/{id}/cancel")
    public WfhResponse cancelWfh(@PathVariable String id) {
        return wfh.cancel(id);
    }

    // ---- shifts
    @GetMapping("/shifts")
    public List<ShiftResponse> shifts() {
        return shifts.all();
    }

    @PostMapping("/shifts")
    @PreAuthorize("hasAuthority('PERM_ATTENDANCE_MANAGE')")
    @ResponseStatus(HttpStatus.CREATED)
    public ShiftResponse createShift(@Valid @RequestBody ShiftRequest req) {
        return shifts.create(req);
    }

    @PutMapping("/shifts/{id}")
    @PreAuthorize("hasAuthority('PERM_ATTENDANCE_MANAGE')")
    public ShiftResponse updateShift(@PathVariable String id, @Valid @RequestBody ShiftRequest req) {
        return shifts.update(id, req);
    }

    @DeleteMapping("/shifts/{id}")
    @PreAuthorize("hasAuthority('PERM_ATTENDANCE_MANAGE')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteShift(@PathVariable String id) {
        shifts.delete(id);
    }

    @PostMapping("/shifts/{id}/assignments")
    @PreAuthorize("hasAuthority('PERM_ATTENDANCE_MANAGE')")
    @ResponseStatus(HttpStatus.CREATED)
    public AssignmentResponse assign(@PathVariable String id, @Valid @RequestBody AssignmentRequest req) {
        return shifts.assign(id, req);
    }

    @GetMapping("/shifts/assignments/{employeeId}")
    @PreAuthorize("@authz.isSelfOrHr(#employeeId) or hasRole('MANAGER')")
    public List<AssignmentResponse> assignments(@PathVariable String employeeId) {
        return shifts.assignmentsOf(employeeId);
    }
}
