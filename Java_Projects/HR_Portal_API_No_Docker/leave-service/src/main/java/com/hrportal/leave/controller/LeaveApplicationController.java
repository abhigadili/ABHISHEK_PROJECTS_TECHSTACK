package com.hrportal.leave.controller;

import java.util.List;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.hrportal.common.web.PageRequests;
import com.hrportal.common.web.PageResponse;
import com.hrportal.leave.dto.LeaveDtos.ApprovalResponse;
import com.hrportal.leave.dto.LeaveDtos.CancelRequest;
import com.hrportal.leave.dto.LeaveDtos.CommentRequest;
import com.hrportal.leave.dto.LeaveDtos.CommentResponse;
import com.hrportal.leave.dto.LeaveDtos.DecisionRequest;
import com.hrportal.leave.dto.LeaveDtos.LeaveApplicationResponse;
import com.hrportal.leave.dto.LeaveDtos.LeaveApplyRequest;
import com.hrportal.leave.dto.LeaveDtos.LeaveUpdateRequest;
import com.hrportal.leave.service.LeaveApplicationService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@Tag(name = "Leave Applications")
@RestController
@RequestMapping("/api/v1/leaves")
public class LeaveApplicationController {
    private static final Set<String> SORT = Set.of("appliedAt", "fromDate", "toDate", "status", "days");
    private final LeaveApplicationService service;

    public LeaveApplicationController(LeaveApplicationService service) {
        this.service = service;
    }

    @Operation(summary = "Apply for leave (validates range, overlap, eligibility, holidays and balance)")
    @PostMapping("/applications")
    @ResponseStatus(HttpStatus.CREATED)
    public LeaveApplicationResponse apply(@Valid @RequestBody LeaveApplyRequest req) {
        return service.apply(req);
    }

    @Operation(summary = "Change a PENDING application")
    @PutMapping("/applications/{id}")
    public LeaveApplicationResponse update(@PathVariable String id, @Valid @RequestBody LeaveUpdateRequest req) {
        return service.update(id, req);
    }

    @Operation(summary = "My leave applications (filter by status)")
    @GetMapping("/applications/me")
    public PageResponse<LeaveApplicationResponse> mine(@RequestParam(required = false) String status, @RequestParam(defaultValue = "0") int page,
                                                       @RequestParam(defaultValue = "20") int size, @RequestParam(defaultValue = "appliedAt,desc") String sort) {
        return PageResponse.of(service.mine(status, PageRequests.of(page, size, sort, SORT, "appliedAt")));
    }

    @Operation(summary = "Leave applications of an employee (self, their manager or HR)")
    @GetMapping("/applications/employee/{employeeId}")
    public PageResponse<LeaveApplicationResponse> forEmployee(@PathVariable String employeeId, @RequestParam(required = false) String status,
                                                              @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
                                                              @RequestParam(defaultValue = "appliedAt,desc") String sort) {
        return PageResponse.of(service.forEmployee(employeeId, status, PageRequests.of(page, size, sort, SORT, "appliedAt")));
    }

    @GetMapping("/applications/{id}")
    public LeaveApplicationResponse get(@PathVariable String id) {
        return service.get(id);
    }

    @Operation(summary = "Applications waiting for my approval (manager stage / HR stage)")
    @GetMapping("/approvals/pending")
    @PreAuthorize("hasAuthority('PERM_LEAVE_APPROVE')")
    public List<LeaveApplicationResponse> pending() {
        return service.pendingApprovals();
    }

    @PostMapping("/applications/{id}/approve")
    @PreAuthorize("hasAuthority('PERM_LEAVE_APPROVE')")
    public LeaveApplicationResponse approve(@PathVariable String id, @Valid @RequestBody(required = false) DecisionRequest req) {
        return service.approve(id, req == null ? null : req.comment());
    }

    @PostMapping("/applications/{id}/reject")
    @PreAuthorize("hasAuthority('PERM_LEAVE_APPROVE')")
    public LeaveApplicationResponse reject(@PathVariable String id, @Valid @RequestBody(required = false) DecisionRequest req) {
        return service.reject(id, req == null ? null : req.comment());
    }

    @Operation(summary = "Withdraw a PENDING application")
    @PostMapping("/applications/{id}/withdraw")
    public LeaveApplicationResponse withdraw(@PathVariable String id) {
        return service.withdraw(id);
    }

    @Operation(summary = "Request cancellation of an approved leave (a pending one is withdrawn)")
    @PostMapping("/applications/{id}/cancel")
    public LeaveApplicationResponse cancel(@PathVariable String id, @Valid @RequestBody CancelRequest req) {
        return service.requestCancellation(id, req.reason());
    }

    @GetMapping("/cancellation-requests")
    @PreAuthorize("hasAuthority('PERM_LEAVE_APPROVE')")
    public List<LeaveApplicationResponse> cancellationRequests() {
        return service.cancellationRequests();
    }

    @PostMapping("/applications/{id}/cancellation/approve")
    @PreAuthorize("hasAuthority('PERM_LEAVE_APPROVE')")
    public LeaveApplicationResponse approveCancellation(@PathVariable String id, @Valid @RequestBody(required = false) DecisionRequest req) {
        return service.decideCancellation(id, true, req == null ? null : req.comment());
    }

    @PostMapping("/applications/{id}/cancellation/reject")
    @PreAuthorize("hasAuthority('PERM_LEAVE_APPROVE')")
    public LeaveApplicationResponse rejectCancellation(@PathVariable String id, @Valid @RequestBody(required = false) DecisionRequest req) {
        return service.decideCancellation(id, false, req == null ? null : req.comment());
    }

    @GetMapping("/applications/{id}/approvals")
    public List<ApprovalResponse> approvals(@PathVariable String id) {
        return service.approvalHistory(id);
    }

    @PostMapping("/applications/{id}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    public CommentResponse addComment(@PathVariable String id, @Valid @RequestBody CommentRequest req) {
        return service.comment(id, req.comment());
    }

    @GetMapping("/applications/{id}/comments")
    public List<CommentResponse> comments(@PathVariable String id) {
        return service.commentsOf(id);
    }
}
