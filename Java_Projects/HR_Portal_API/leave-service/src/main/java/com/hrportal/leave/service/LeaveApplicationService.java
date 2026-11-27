package com.hrportal.leave.service;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import com.hrportal.common.audit.AuditService;
import com.hrportal.common.cache.DistributedLockService;
import com.hrportal.common.exception.BadRequestException;
import com.hrportal.common.exception.ConflictException;
import com.hrportal.common.exception.ForbiddenOperationException;
import com.hrportal.common.exception.ResourceNotFoundException;
import com.hrportal.common.exception.ServiceUnavailableException;
import com.hrportal.common.security.AuthenticatedUser;
import com.hrportal.common.security.CurrentUser;
import com.hrportal.leave.client.EmployeeClient;
import com.hrportal.leave.client.EmployeeClient.EmployeeInfo;
import com.hrportal.leave.client.HolidayGateway;
import com.hrportal.leave.dto.LeaveDtos.ApprovalResponse;
import com.hrportal.leave.dto.LeaveDtos.AttachmentDto;
import com.hrportal.leave.dto.LeaveDtos.CommentResponse;
import com.hrportal.leave.dto.LeaveDtos.LeaveApplicationResponse;
import com.hrportal.leave.dto.LeaveDtos.LeaveApplyRequest;
import com.hrportal.leave.dto.LeaveDtos.LeaveTypeResponse;
import com.hrportal.leave.dto.LeaveDtos.LeaveUpdateRequest;
import com.hrportal.leave.entity.Enums.ApprovalAction;
import com.hrportal.leave.entity.Enums.ApprovalStage;
import com.hrportal.leave.entity.Enums.LeaveStatus;
import com.hrportal.leave.entity.LeaveApplication;
import com.hrportal.leave.entity.LeaveApproval;
import com.hrportal.leave.entity.LeaveAttachment;
import com.hrportal.leave.entity.LeaveComment;
import com.hrportal.leave.producer.LeaveEventProducer;
import com.hrportal.leave.repository.LeaveRepositories.ApprovalRepository;
import com.hrportal.leave.repository.LeaveRepositories.AttachmentRepository;
import com.hrportal.leave.repository.LeaveRepositories.CommentRepository;
import com.hrportal.leave.repository.LeaveRepositories.LeaveApplicationRepository;
import com.hrportal.leave.service.LeaveCatalogService.LeavePolicyService;
import com.hrportal.leave.service.LeaveCatalogService.LeaveTypeService;

import feign.FeignException;

/**
 * The leave workflow. Apply -> (manager approval) -> (HR approval when the leave is long or the type requires it) -> approved.
 * Balance rules: applying RESERVES days (pending), approval CONSUMES them (used), rejection / withdrawal releases them,
 * approved-leave cancellation (itself approved) gives them back.
 * Concurrency: a Redis lock serialises the apply flow per employee across service instances and the balance row is
 * read with SELECT ... FOR UPDATE inside the transaction.
 */
@Service
public class LeaveApplicationService {
    private static final Logger log = LoggerFactory.getLogger(LeaveApplicationService.class);
    private static final Set<LeaveStatus> LIVE = Set.of(LeaveStatus.PENDING, LeaveStatus.APPROVED);

    private final LeaveApplicationRepository applications;
    private final ApprovalRepository approvals;
    private final CommentRepository comments;
    private final AttachmentRepository attachments;
    private final LeaveBalanceService balances;
    private final LeaveDurationService durations;
    private final LeaveTypeService types;
    private final LeavePolicyService policies;
    private final EmployeeClient employeeClient;
    private final HolidayGateway holidays;
    private final LeaveEventProducer producer;
    private final AuditService audit;
    private final DistributedLockService locks;
    private final TransactionTemplate tx;
    private final int maxBackdateDays;

    public LeaveApplicationService(LeaveApplicationRepository applications, ApprovalRepository approvals, CommentRepository comments,
                                   AttachmentRepository attachments, LeaveBalanceService balances, LeaveDurationService durations,
                                   LeaveTypeService types, LeavePolicyService policies, EmployeeClient employeeClient, HolidayGateway holidays,
                                   LeaveEventProducer producer, AuditService audit, DistributedLockService locks, TransactionTemplate tx,
                                   @Value("${hr.leave.max-backdate-days:7}") int maxBackdateDays) {
        this.applications = applications;
        this.approvals = approvals;
        this.comments = comments;
        this.attachments = attachments;
        this.balances = balances;
        this.durations = durations;
        this.types = types;
        this.policies = policies;
        this.employeeClient = employeeClient;
        this.holidays = holidays;
        this.producer = producer;
        this.audit = audit;
        this.locks = locks;
        this.tx = tx;
        this.maxBackdateDays = maxBackdateDays;
    }

    // ================================================================== apply / update
    public LeaveApplicationResponse apply(LeaveApplyRequest req) {
        String employeeId = requireOwnEmployeeId();
        // lock OUTSIDE the transaction: the lock must be released only after the transaction has committed
        return locks.withLock("leave-apply:" + employeeId, Duration.ofSeconds(20), () -> tx.execute(s -> doApply(employeeId, req)));
    }

    private LeaveApplicationResponse doApply(String employeeId, LeaveApplyRequest req) {
        LeaveTypeResponse type = types.byId().get(req.leaveTypeId());
        if (type == null) throw new BadRequestException("Unknown or inactive leave type");
        EmployeeInfo emp = employee(employeeId);
        validateEligibility(type, emp, req.fromDate(), req.halfDayStart() || req.halfDayEnd());
        if (applications.existsOverlap(employeeId, req.fromDate(), req.toDate(), LIVE, null)) {
            throw new ConflictException("The requested dates overlap an existing leave application");
        }
        BigDecimal days = daysFor(emp, req.fromDate(), req.toDate(), req.halfDayStart(), req.halfDayEnd());
        List<String> docs = req.attachmentDocumentIds() == null ? List.of() : req.attachmentDocumentIds();
        if (type.attachmentRequiredFromDays() != null && days.compareTo(BigDecimal.valueOf(type.attachmentRequiredFromDays())) >= 0 && docs.isEmpty()) {
            throw new BadRequestException(type.name() + " of " + type.attachmentRequiredFromDays() + " or more days needs a supporting document");
        }
        if (type.balanceTracked()) balances.reserve(employeeId, type.id(), req.fromDate().getYear(), days);

        LeaveApplication a = new LeaveApplication();
        a.setEmployeeId(employeeId);
        a.setEmployeeName(emp.fullName());
        a.setLeaveTypeId(type.id());
        a.setFromDate(req.fromDate());
        a.setToDate(req.toDate());
        a.setHalfDayStart(req.halfDayStart());
        a.setHalfDayEnd(req.halfDayEnd());
        a.setDays(days);
        a.setReason(req.reason());
        a.setManagerId(emp.managerId());
        a.setStage(emp.managerId() == null ? ApprovalStage.HR : ApprovalStage.MANAGER);   // no manager: HR decides directly
        a = applications.save(a);
        history(a, ApprovalAction.SUBMITTED, employeeId, req.reason());
        for (String docId : docs) {
            LeaveAttachment at = new LeaveAttachment();
            at.setApplicationId(a.getId());
            at.setDocumentId(docId);
            attachments.save(at);
        }
        producer.applied(a, type.name());
        audit.record("LeaveApplication", a.getId(), "APPLIED", a.getFromDate() + ".." + a.getToDate() + " " + days + "d");
        log.info("Leave {} applied by {}: {} .. {} ({} days)", a.getId(), employeeId, a.getFromDate(), a.getToDate(), days);
        return toResponse(a);
    }

    public LeaveApplicationResponse update(String id, LeaveUpdateRequest req) {
        LeaveApplication existing = find(id);
        String employeeId = existing.getEmployeeId();
        requireOwner(existing);
        return locks.withLock("leave-apply:" + employeeId, Duration.ofSeconds(20), () -> tx.execute(s -> doUpdate(id, req)));
    }

    private LeaveApplicationResponse doUpdate(String id, LeaveUpdateRequest req) {
        LeaveApplication a = find(id);
        if (a.getStatus() != LeaveStatus.PENDING) throw new BadRequestException("Only a PENDING application can be changed");
        if (req.toDate().isBefore(req.fromDate())) throw new BadRequestException("End date must be on or after the start date");
        LeaveTypeResponse type = types.byId().get(a.getLeaveTypeId());
        EmployeeInfo emp = employee(a.getEmployeeId());
        validateEligibility(type, emp, req.fromDate(), req.halfDayStart() || req.halfDayEnd());
        if (applications.existsOverlap(a.getEmployeeId(), req.fromDate(), req.toDate(), LIVE, a.getId())) {
            throw new ConflictException("The requested dates overlap an existing leave application");
        }
        BigDecimal days = daysFor(emp, req.fromDate(), req.toDate(), req.halfDayStart(), req.halfDayEnd());
        if (type.balanceTracked()) {
            balances.releasePending(a.getEmployeeId(), type.id(), a.getFromDate().getYear(), a.getDays());
            balances.reserve(a.getEmployeeId(), type.id(), req.fromDate().getYear(), days);
        }
        a.setFromDate(req.fromDate());
        a.setToDate(req.toDate());
        a.setHalfDayStart(req.halfDayStart());
        a.setHalfDayEnd(req.halfDayEnd());
        a.setDays(days);
        a.setReason(req.reason());
        a.setStage(a.getManagerId() == null ? ApprovalStage.HR : ApprovalStage.MANAGER);   // changes restart approval
        applications.save(a);
        history(a, ApprovalAction.UPDATED, a.getEmployeeId(), req.reason());
        audit.record("LeaveApplication", id, "UPDATED", a.getFromDate() + ".." + a.getToDate() + " " + days + "d");
        return toResponse(a);
    }

    // ================================================================== decisions
    @Transactional
    public LeaveApplicationResponse approve(String id, String comment) {
        LeaveApplication a = find(id);
        requirePending(a);
        AuthenticatedUser me = CurrentUser.require();
        forbidSelfDecision(a, me);
        LeaveTypeResponse type = types.byId().get(a.getLeaveTypeId());
        boolean hr = CurrentUser.isHr();
        if (a.getStage() == ApprovalStage.MANAGER) {
            if (!hr && !me.employeeId().equals(a.getManagerId())) throw new ForbiddenOperationException("Only the employee's manager (or HR) can approve at this stage");
            boolean needsHr = type != null && (type.requiresHrApproval() || a.getDays().compareTo(BigDecimal.valueOf(policies.defaultPolicy().hrApprovalThresholdDays())) > 0);
            if (needsHr && !hr) {
                a.setStage(ApprovalStage.HR);
                applications.save(a);
                history(a, ApprovalAction.MANAGER_APPROVED, me.employeeId(), comment);
                producer.notify(a.getEmployeeId(), "LEAVE_FORWARDED_HR", a, type.name(), comment, "forwarded");
                audit.record("LeaveApplication", id, "MANAGER_APPROVED", "forwarded to HR");
                return toResponse(a);
            }
            return finalizeApproval(a, type, me, hr ? ApprovalAction.HR_APPROVED : ApprovalAction.MANAGER_APPROVED, comment);
        }
        if (!hr) throw new ForbiddenOperationException("This application waits for HR approval");
        return finalizeApproval(a, type, me, ApprovalAction.HR_APPROVED, comment);
    }

    private LeaveApplicationResponse finalizeApproval(LeaveApplication a, LeaveTypeResponse type, AuthenticatedUser me, ApprovalAction action, String comment) {
        a.setStatus(LeaveStatus.APPROVED);
        a.setStage(ApprovalStage.COMPLETE);
        a.setDecidedAt(java.time.Instant.now());
        applications.save(a);
        if (type.balanceTracked()) balances.commitUsed(a.getEmployeeId(), type.id(), a.getFromDate().getYear(), a.getDays());
        history(a, action, me.employeeId(), comment);
        producer.approved(a, type.name(), me.employeeId(), comment);
        audit.record("LeaveApplication", a.getId(), "APPROVED", action.name());
        return toResponse(a);
    }

    @Transactional
    public LeaveApplicationResponse reject(String id, String comment) {
        LeaveApplication a = find(id);
        requirePending(a);
        AuthenticatedUser me = CurrentUser.require();
        forbidSelfDecision(a, me);
        boolean hr = CurrentUser.isHr();
        if (a.getStage() == ApprovalStage.MANAGER && !hr && !me.employeeId().equals(a.getManagerId())) throw new ForbiddenOperationException("Only the employee's manager (or HR) can reject");
        if (a.getStage() == ApprovalStage.HR && !hr) throw new ForbiddenOperationException("This application waits for HR");
        LeaveTypeResponse type = types.byId().get(a.getLeaveTypeId());
        a.setStatus(LeaveStatus.REJECTED);
        a.setStage(ApprovalStage.COMPLETE);
        a.setDecidedAt(java.time.Instant.now());
        applications.save(a);
        if (type.balanceTracked()) balances.releasePending(a.getEmployeeId(), type.id(), a.getFromDate().getYear(), a.getDays());
        history(a, ApprovalAction.REJECTED, me.employeeId(), comment);
        producer.rejected(a, type.name(), me.employeeId(), comment);
        audit.record("LeaveApplication", id, "REJECTED", comment);
        return toResponse(a);
    }

    @Transactional
    public LeaveApplicationResponse withdraw(String id) {
        LeaveApplication a = find(id);
        requireOwner(a);
        requirePending(a);
        LeaveTypeResponse type = types.byId().get(a.getLeaveTypeId());
        a.setStatus(LeaveStatus.WITHDRAWN);
        a.setStage(ApprovalStage.COMPLETE);
        a.setDecidedAt(java.time.Instant.now());
        applications.save(a);
        if (type.balanceTracked()) balances.releasePending(a.getEmployeeId(), type.id(), a.getFromDate().getYear(), a.getDays());
        history(a, ApprovalAction.WITHDRAWN, a.getEmployeeId(), null);
        producer.cancelled(a, type.name(), a.getEmployeeId(), "Withdrawn by employee");
        audit.record("LeaveApplication", id, "WITHDRAWN", null);
        return toResponse(a);
    }

    /** Cancelling an APPROVED leave needs approval itself (the employee only requests it). */
    @Transactional
    public LeaveApplicationResponse requestCancellation(String id, String reason) {
        LeaveApplication a = find(id);
        requireOwner(a);
        if (a.getStatus() == LeaveStatus.PENDING) return withdraw(id);
        if (a.getStatus() != LeaveStatus.APPROVED) throw new BadRequestException("Only PENDING or APPROVED applications can be cancelled");
        if (a.getToDate().isBefore(LocalDate.now())) throw new BadRequestException("A leave that has already ended cannot be cancelled");
        if (a.isCancelRequested()) throw new ConflictException("A cancellation request is already open");
        a.setCancelRequested(true);
        a.setCancelReason(reason);
        applications.save(a);
        history(a, ApprovalAction.CANCEL_REQUESTED, a.getEmployeeId(), reason);
        LeaveTypeResponse type = types.byId().get(a.getLeaveTypeId());
        String approver = a.getManagerId();
        if (approver != null) producer.notify(approver, "LEAVE_CANCEL_REQUESTED", a, type.name(), reason, "cancel-requested");
        audit.record("LeaveApplication", id, "CANCEL_REQUESTED", reason);
        return toResponse(a);
    }

    @Transactional
    public LeaveApplicationResponse decideCancellation(String id, boolean approve, String comment) {
        LeaveApplication a = find(id);
        AuthenticatedUser me = CurrentUser.require();
        if (a.getStatus() != LeaveStatus.APPROVED || !a.isCancelRequested()) throw new BadRequestException("No cancellation request is open for this application");
        forbidSelfDecision(a, me);
        if (!CurrentUser.isHr() && !me.employeeId().equals(a.getManagerId())) throw new ForbiddenOperationException("Only the manager or HR can decide a cancellation request");
        LeaveTypeResponse type = types.byId().get(a.getLeaveTypeId());
        a.setCancelRequested(false);
        if (approve) {
            a.setStatus(LeaveStatus.CANCELLED);
            a.setDecidedAt(java.time.Instant.now());
            applications.save(a);
            if (type.balanceTracked()) balances.restoreUsed(a.getEmployeeId(), type.id(), a.getFromDate().getYear(), a.getDays());
            history(a, ApprovalAction.CANCEL_APPROVED, me.employeeId(), comment);
            producer.cancelled(a, type.name(), me.employeeId(), comment);
        } else {
            applications.save(a);
            history(a, ApprovalAction.CANCEL_REJECTED, me.employeeId(), comment);
            producer.notify(a.getEmployeeId(), "LEAVE_CANCEL_REJECTED", a, type.name(), comment, "cancel-rejected");
        }
        audit.record("LeaveApplication", id, approve ? "CANCEL_APPROVED" : "CANCEL_REJECTED", comment);
        return toResponse(a);
    }

    @Transactional
    public CommentResponse comment(String id, String text) {
        LeaveApplication a = find(id);
        requireCanSee(a);
        LeaveComment c = new LeaveComment();
        c.setApplicationId(id);
        c.setAuthorId(CurrentUser.employeeId());
        c.setComment(text);
        c = comments.save(c);
        return new CommentResponse(c.getId(), id, c.getAuthorId(), c.getComment(), c.getCreatedAt());
    }

    // ================================================================== queries
    @Transactional(readOnly = true)
    public LeaveApplicationResponse get(String id) {
        LeaveApplication a = find(id);
        requireCanSee(a);
        return toResponse(a);
    }

    @Transactional(readOnly = true)
    public Page<LeaveApplicationResponse> mine(String status, Pageable pageable) {
        return forEmployee(requireOwnEmployeeId(), status, pageable);
    }

    @Transactional(readOnly = true)
    public Page<LeaveApplicationResponse> forEmployee(String employeeId, String status, Pageable pageable) {
        if (!CurrentUser.isHr() && !employeeId.equals(CurrentUser.employeeId())) {
            EmployeeInfo emp = employee(employeeId);
            if (!CurrentUser.employeeId().equals(emp.managerId())) throw new ForbiddenOperationException("You can only view your own or your team's leave");
        }
        Page<LeaveApplication> page = status == null || status.isBlank() ? applications.findByEmployeeId(employeeId, pageable)
                : applications.findByEmployeeIdAndStatus(employeeId, parseStatus(status), pageable);
        return toResponses(page);
    }

    /** What waits for ME: manager-stage applications of my team, HR-stage applications when I am HR. */
    @Transactional(readOnly = true)
    public List<LeaveApplicationResponse> pendingApprovals() {
        Map<String, LeaveApplication> out = new LinkedHashMap<>();
        String me = CurrentUser.employeeId();
        if (me != null) applications.findByManagerIdAndStatusAndStageOrderByAppliedAtAsc(me, LeaveStatus.PENDING, ApprovalStage.MANAGER).forEach(a -> out.put(a.getId(), a));
        if (CurrentUser.isHr()) applications.findByStatusAndStageOrderByAppliedAtAsc(LeaveStatus.PENDING, ApprovalStage.HR).forEach(a -> out.put(a.getId(), a));
        return toResponses(new ArrayList<>(out.values()));
    }

    @Transactional(readOnly = true)
    public List<LeaveApplicationResponse> cancellationRequests() {
        String me = CurrentUser.employeeId();
        List<LeaveApplication> list = applications.findByStatusAndCancelRequestedTrueOrderByAppliedAtAsc(LeaveStatus.APPROVED).stream()
                .filter(a -> CurrentUser.isHr() || (me != null && me.equals(a.getManagerId()))).toList();
        return toResponses(list);
    }

    @Transactional(readOnly = true)
    public List<ApprovalResponse> approvalHistory(String id) {
        requireCanSee(find(id));
        return approvals.findByApplicationIdOrderByCreatedAtAsc(id).stream().map(h -> new ApprovalResponse(h.getId(), h.getApplicationId(), h.getStage().name(),
                h.getAction().name(), h.getActorId(), h.getComment(), h.getCreatedAt())).toList();
    }

    @Transactional(readOnly = true)
    public List<CommentResponse> commentsOf(String id) {
        requireCanSee(find(id));
        return comments.findByApplicationIdOrderByCreatedAtAsc(id).stream().map(c -> new CommentResponse(c.getId(), c.getApplicationId(), c.getAuthorId(), c.getComment(), c.getCreatedAt())).toList();
    }

    // ================================================================== helpers
    private void validateEligibility(LeaveTypeResponse type, EmployeeInfo emp, LocalDate from, boolean half) {
        if ("TERMINATED".equals(emp.status()) || "RESIGNED".equals(emp.status())) throw new BadRequestException("Employee is no longer active");
        if (type.genderRestriction() != null && !type.genderRestriction().equalsIgnoreCase(String.valueOf(emp.gender()))) {
            throw new BadRequestException(type.name() + " is not available for this employee");
        }
        if (half && !type.halfDayAllowed()) throw new BadRequestException("Half-day is not allowed for " + type.name());
        if (from.isBefore(LocalDate.now().minusDays(maxBackdateDays))) throw new BadRequestException("Leave cannot be applied more than " + maxBackdateDays + " days in the past");
    }

    private BigDecimal daysFor(EmployeeInfo emp, LocalDate from, LocalDate to, boolean halfStart, boolean halfEnd) {
        Set<LocalDate> hol = holidays.holidays(from, to, emp.locationId(), emp.departmentId());
        BigDecimal days = durations.duration(from, to, halfStart, halfEnd, hol);
        if (days.signum() <= 0) throw new BadRequestException("The selected dates contain no working days (weekends / holidays only)");
        return days;
    }

    private EmployeeInfo employee(String employeeId) {
        try {
            return employeeClient.summary(employeeId);
        } catch (ResourceNotFoundException e) {
            throw new BadRequestException("Employee not found: " + employeeId);
        } catch (FeignException e) {
            throw new ServiceUnavailableException("Employee service is unavailable");
        }
    }

    private void history(LeaveApplication a, ApprovalAction action, String actor, String comment) {
        LeaveApproval h = new LeaveApproval();
        h.setApplicationId(a.getId());
        h.setStage(a.getStage());
        h.setAction(action);
        h.setActorId(actor);
        h.setComment(comment);
        approvals.save(h);
    }

    private static void requirePending(LeaveApplication a) {
        if (a.getStatus() != LeaveStatus.PENDING) throw new BadRequestException("Application is already " + a.getStatus());
    }

    private static String requireOwnEmployeeId() {
        String me = CurrentUser.employeeId();
        if (me == null) throw new ForbiddenOperationException("Your account is not linked to an employee record");
        return me;
    }

    private static void requireOwner(LeaveApplication a) {
        if (!a.getEmployeeId().equals(CurrentUser.employeeId())) throw new ForbiddenOperationException("Only the applicant can do this");
    }

    private static void forbidSelfDecision(LeaveApplication a, AuthenticatedUser me) {
        if (a.getEmployeeId().equals(me.employeeId())) throw new ForbiddenOperationException("You cannot decide your own leave application");
        if (me.employeeId() == null && !CurrentUser.isHr()) throw new ForbiddenOperationException("Your account is not linked to an employee record");
    }

    private void requireCanSee(LeaveApplication a) {
        String me = CurrentUser.employeeId();
        if (CurrentUser.isHr() || (me != null && (me.equals(a.getEmployeeId()) || me.equals(a.getManagerId())))) return;
        throw new ForbiddenOperationException("You cannot view this leave application");
    }

    private static LeaveStatus parseStatus(String s) {
        try {
            return LeaveStatus.valueOf(s.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Unknown status: " + s);
        }
    }

    LeaveApplication find(String id) {
        return applications.findById(id).orElseThrow(() -> ResourceNotFoundException.of("Leave application", id));
    }

    // ---- mapping (names + attachments resolved in bulk: no N+1)
    private LeaveApplicationResponse toResponse(LeaveApplication a) {
        return toResponses(List.of(a)).get(0);
    }

    private Page<LeaveApplicationResponse> toResponses(Page<LeaveApplication> page) {
        List<LeaveApplicationResponse> mapped = toResponses(page.getContent());
        return new org.springframework.data.domain.PageImpl<>(mapped, page.getPageable(), page.getTotalElements());
    }

    private List<LeaveApplicationResponse> toResponses(Collection<LeaveApplication> list) {
        if (list.isEmpty()) return List.of();
        Map<String, LeaveTypeResponse> typeMap = types.byId();
        Map<String, List<AttachmentDto>> att = attachments.findByApplicationIdIn(list.stream().map(LeaveApplication::getId).toList()).stream()
                .collect(Collectors.groupingBy(LeaveAttachment::getApplicationId,
                        Collectors.mapping(x -> new AttachmentDto(x.getId(), x.getDocumentId(), x.getFileName()), Collectors.toList())));
        return list.stream().map(a -> new LeaveApplicationResponse(a.getId(), a.getEmployeeId(), a.getEmployeeName(), a.getLeaveTypeId(),
                typeMap.containsKey(a.getLeaveTypeId()) ? typeMap.get(a.getLeaveTypeId()).name() : null, a.getFromDate(), a.getToDate(), a.isHalfDayStart(),
                a.isHalfDayEnd(), a.getDays(), a.getReason(), a.getStatus().name(), a.getStage().name(), a.getManagerId(), a.isCancelRequested(),
                a.getCancelReason(), a.getAppliedAt(), a.getDecidedAt(), att.getOrDefault(a.getId(), List.of()))).toList();
    }
}
