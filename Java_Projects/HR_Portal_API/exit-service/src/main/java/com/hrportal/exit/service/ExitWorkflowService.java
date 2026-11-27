package com.hrportal.exit.service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hrportal.common.audit.AuditService;
import com.hrportal.common.exception.BadRequestException;
import com.hrportal.common.exception.ConflictException;
import com.hrportal.common.exception.ForbiddenOperationException;
import com.hrportal.common.exception.ResourceNotFoundException;
import com.hrportal.common.exception.ServiceUnavailableException;
import com.hrportal.common.persistence.BeanMapper;
import com.hrportal.common.security.CurrentUser;
import com.hrportal.common.security.Role;
import com.hrportal.exit.client.ExitClients.EmployeeClient;
import com.hrportal.exit.client.ExitClients.EmployeeInfo;
import com.hrportal.exit.dto.ExitDtos.ConfirmRequest;
import com.hrportal.exit.dto.ExitDtos.HistoryResponse;
import com.hrportal.exit.dto.ExitDtos.ManagerDecision;
import com.hrportal.exit.dto.ExitDtos.PolicyRequest;
import com.hrportal.exit.dto.ExitDtos.PolicyResponse;
import com.hrportal.exit.dto.ExitDtos.ResignationRequest;
import com.hrportal.exit.dto.ExitDtos.ResignationResponse;
import com.hrportal.exit.dto.ExitDtos.StatusSummary;
import com.hrportal.exit.entity.AccessRevocationTask;
import com.hrportal.exit.entity.AssetReturnTask;
import com.hrportal.exit.entity.ChecklistTask;
import com.hrportal.exit.entity.ClearanceTask;
import com.hrportal.exit.entity.Enums.ResignationStatus;
import com.hrportal.exit.entity.ExitHistory;
import com.hrportal.exit.entity.ExitPolicy;
import com.hrportal.exit.entity.KnowledgeTransferTask;
import com.hrportal.exit.entity.Resignation;
import com.hrportal.exit.producer.ExitEventProducer;
import com.hrportal.exit.repository.ExitRepositories.HistoryRepository;
import com.hrportal.exit.repository.ExitRepositories.PolicyRepository;
import com.hrportal.exit.repository.ExitRepositories.ResignationRepository;
import com.hrportal.exit.repository.ExitRepositories.TaskRepository;

import feign.FeignException;

/**
 * The exit workflow as an explicit state machine:
 * 1) employee submits -> 2) manager approves / rejects -> 3) HR confirms the last working day (and generates the exit checklist: clearances,
 * checklist, knowledge transfer, assets, access revocation) -> 4,5) tasks and clearances are completed (status CLEARED automatically) ->
 * 6) exit interview (INTERVIEW_DONE) -> 7) settlement (SettlementService) -> 8) completion publishes employee.exited.
 * Every transition is validated, logged to the exit history, audited and notified.
 */
@Service
@Transactional
public class ExitWorkflowService {
    private static final Logger log = LoggerFactory.getLogger(ExitWorkflowService.class);
    private static final EnumSet<ResignationStatus> FINISHED = EnumSet.of(ResignationStatus.COMPLETED, ResignationStatus.WITHDRAWN, ResignationStatus.MANAGER_REJECTED);

    private final ResignationRepository resignations;
    private final TaskRepository tasks;
    private final HistoryRepository history;
    private final PolicyRepository policies;
    private final EmployeeClient employeeClient;
    private final ExitEventProducer producer;
    private final AuditService audit;

    public ExitWorkflowService(ResignationRepository resignations, TaskRepository tasks, HistoryRepository history, PolicyRepository policies, EmployeeClient employeeClient,
                               ExitEventProducer producer, AuditService audit) {
        this.resignations = resignations;
        this.tasks = tasks;
        this.history = history;
        this.policies = policies;
        this.employeeClient = employeeClient;
        this.producer = producer;
        this.audit = audit;
    }

    // ------------------------------------------------------------------ 1. submit
    public ResignationResponse submit(ResignationRequest req) {
        String me = CurrentUser.employeeId();
        if (me == null) throw new ForbiddenOperationException("Your account is not linked to an employee record");
        if (resignations.existsByEmployeeIdAndStatusNotIn(me, FINISHED)) throw new ConflictException("You already have an open resignation");
        EmployeeInfo emp;
        try {
            emp = employeeClient.summary(me);
        } catch (FeignException e) {
            throw new ServiceUnavailableException("Employee service is unavailable");
        }
        if ("RESIGNED".equals(emp.status()) || "TERMINATED".equals(emp.status())) throw new BadRequestException("The employee has already left");
        ExitPolicy policy = policy();
        int notice = emp.noticePeriodDays() > 0 ? emp.noticePeriodDays() : policy.getDefaultNoticeDays();
        LocalDate today = LocalDate.now();
        int shortfall = (int) Math.max(0, notice - ChronoUnit.DAYS.between(today, req.requestedLastWorkingDay()));
        if (shortfall > policy.getMaxWaiverDays()) {
            throw new BadRequestException("The requested last working day is " + shortfall + " day(s) short of the " + notice + "-day notice period; "
                    + "at most " + policy.getMaxWaiverDays() + " day(s) of notice can be waived. Earliest allowed: " + today.plusDays(notice - policy.getMaxWaiverDays()));
        }
        Resignation r = new Resignation();
        r.setEmployeeId(me);
        r.setEmployeeName(emp.fullName());
        r.setManagerId(emp.managerId());
        r.setDepartmentId(emp.departmentId());
        r.setJoiningDate(emp.joiningDate());
        r.setSubmittedOn(today);
        r.setRequestedLastWorkingDay(req.requestedLastWorkingDay());
        r.setNoticePeriodDays(notice);
        r.setReason(req.reason());
        r = resignations.save(r);
        log(r, null, "Resignation submitted");
        producer.submitted(r);
        producer.notify(r.getManagerId(), "EXIT_RESIGNATION_SUBMITTED", r, Map.of(), "submitted");
        audit.record("Resignation", r.getId(), "SUBMITTED", r.getRequestedLastWorkingDay());
        return toResponse(r);
    }

    public ResignationResponse withdraw(String id) {
        Resignation r = find(id);
        if (!r.getEmployeeId().equals(CurrentUser.employeeId())) throw new ForbiddenOperationException("Only the employee can withdraw the resignation");
        boolean confirmed = r.getStatus() != ResignationStatus.SUBMITTED && r.getStatus() != ResignationStatus.MANAGER_APPROVED;
        if (r.getStatus() == ResignationStatus.COMPLETED || r.getStatus() == ResignationStatus.WITHDRAWN || r.getStatus() == ResignationStatus.MANAGER_REJECTED) throw new BadRequestException("The resignation is " + r.getStatus());
        if (confirmed && !policy().isWithdrawalAfterConfirmation()) throw new BadRequestException("The resignation can no longer be withdrawn after HR confirmed the last working day");
        return move(r, ResignationStatus.WITHDRAWN, "Withdrawn by the employee");
    }

    // ------------------------------------------------------------------ 2. manager review
    public ResignationResponse managerDecision(String id, ManagerDecision d) {
        Resignation r = find(id);
        if (r.getStatus() != ResignationStatus.SUBMITTED) throw new BadRequestException("The resignation is " + r.getStatus());
        requireManagerOrHr(r);
        r.setManagerComment(d.comment());
        ResignationResponse out = move(r, d.approve() ? ResignationStatus.MANAGER_APPROVED : ResignationStatus.MANAGER_REJECTED, d.comment());
        producer.notify(r.getEmployeeId(), "EXIT_RESIGNATION_DECIDED", r, Map.of("decision", d.approve() ? "approved" : "rejected", "comment", d.comment() == null ? "" : d.comment()), "mgr");
        return out;
    }

    // ------------------------------------------------------------------ 3. HR confirms the last working day, checklist is generated
    public ResignationResponse confirm(String id, ConfirmRequest req) {
        Resignation r = find(id);
        if (r.getStatus() != ResignationStatus.MANAGER_APPROVED) throw new BadRequestException("HR can confirm only after the manager approved (current: " + r.getStatus() + ")");
        ExitPolicy policy = policy();
        int waiver = req.waiverDays() == null ? 0 : req.waiverDays();
        if (waiver > policy.getMaxWaiverDays()) throw new BadRequestException("Notice waiver is limited to " + policy.getMaxWaiverDays() + " day(s)");
        long noticeServed = ChronoUnit.DAYS.between(r.getSubmittedOn(), req.confirmedLastWorkingDay());
        long shortfall = Math.max(0, r.getNoticePeriodDays() - noticeServed);
        if (waiver > shortfall) throw new BadRequestException("The waiver (" + waiver + ") exceeds the notice shortfall (" + shortfall + " day(s))");
        if (!req.confirmedLastWorkingDay().isAfter(LocalDate.now().minusDays(1))) throw new BadRequestException("The last working day cannot be in the past");
        r.setConfirmedLastWorkingDay(req.confirmedLastWorkingDay());
        r.setWaiverDays(waiver);
        r.setHrComment(req.comment());
        generateChecklist(r);
        ResignationResponse out = move(r, ResignationStatus.HR_CONFIRMED, req.comment());
        producer.notify(r.getEmployeeId(), "EXIT_LWD_CONFIRMED", r, Map.of(), "confirmed");
        return out;
    }

    /** The standard exit checklist: one task of each kind, due on / before the last working day. */
    private void generateChecklist(Resignation r) {
        LocalDate due = r.getConfirmedLastWorkingDay();
        for (String dept : List.of("MANAGER", "IT", "FINANCE", "ADMIN", "HR")) {
            ClearanceTask c = new ClearanceTask();
            c.setResignationId(r.getId());
            c.setTitle(dept + " clearance");
            c.setDepartment(dept);
            c.setDueDate(due);
            tasks.save(c);
            if (!dept.equals("MANAGER")) continue;
        }
        ChecklistTask form = new ChecklistTask();
        form.setResignationId(r.getId());
        form.setTitle("Hand over documents and complete the leaver form");
        form.setDueDate(due.minusDays(1));
        tasks.save(form);
        KnowledgeTransferTask kt = new KnowledgeTransferTask();
        kt.setResignationId(r.getId());
        kt.setTitle("Knowledge transfer to the team");
        kt.setTopic("Ongoing work and responsibilities");
        kt.setDueDate(due.minusDays(2));
        tasks.save(kt);
        AssetReturnTask asset = new AssetReturnTask();
        asset.setResignationId(r.getId());
        asset.setTitle("Return company assets (laptop, access card)");
        asset.setDueDate(due);
        tasks.save(asset);
        AccessRevocationTask access = new AccessRevocationTask();
        access.setResignationId(r.getId());
        access.setTitle("Revoke system access");
        access.setSystemName("E-mail, VPN, source control");
        access.setDueDate(due);
        tasks.save(access);
        log.info("Exit checklist generated for resignation {}", r.getId());
    }

    // ------------------------------------------------------------------ queries
    @Transactional(readOnly = true)
    public ResignationResponse get(String id) {
        Resignation r = find(id);
        requireView(r);
        return toResponse(r);
    }

    @Transactional(readOnly = true)
    public List<ResignationResponse> mine() {
        String me = CurrentUser.employeeId();
        if (me == null) throw new ForbiddenOperationException("Your account is not linked to an employee record");
        return resignations.findByEmployeeIdOrderByCreatedAtDesc(me).stream().map(this::toResponse).toList();
    }

    /** What waits for me: manager -> SUBMITTED reports; HR -> everything still open. */
    @Transactional(readOnly = true)
    public List<ResignationResponse> pending() {
        Map<String, Resignation> out = new java.util.LinkedHashMap<>();
        String me = CurrentUser.employeeId();
        if (me != null) resignations.findByManagerIdAndStatus(me, ResignationStatus.SUBMITTED).forEach(r -> out.put(r.getId(), r));
        if (CurrentUser.isHr()) resignations.findOpen().forEach(r -> out.put(r.getId(), r));
        return out.values().stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public Page<ResignationResponse> list(String status, Pageable pageable) {
        if (status == null || status.isBlank()) return resignations.findAll(pageable).map(this::toResponse);
        return resignations.findByStatus(ResignationStatus.valueOf(status.toUpperCase()), pageable).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public List<HistoryResponse> historyOf(String id) {
        requireView(find(id));
        return BeanMapper.toRecords(history.findByResignationIdOrderByCreatedAtAsc(id), HistoryResponse.class);
    }

    @Transactional(readOnly = true)
    public StatusSummary summary() {
        Map<String, Long> by = resignations.findAll().stream().collect(Collectors.groupingBy(r -> r.getStatus().name(), java.util.TreeMap::new, Collectors.counting()));
        return new StatusSummary(by, by.values().stream().mapToLong(Long::longValue).sum());
    }

    // ------------------------------------------------------------------ policy
    @Transactional(readOnly = true)
    public PolicyResponse getPolicy() {
        return BeanMapper.toRecord(policy(), PolicyResponse.class);
    }

    public PolicyResponse updatePolicy(PolicyRequest req) {
        ExitPolicy p = policy();
        if (req.defaultNoticeDays() != null) p.setDefaultNoticeDays(req.defaultNoticeDays());
        if (req.maxWaiverDays() != null) p.setMaxWaiverDays(req.maxWaiverDays());
        if (req.withdrawalAfterConfirmation() != null) p.setWithdrawalAfterConfirmation(req.withdrawalAfterConfirmation());
        if (req.salaryDaysPerMonth() != null) p.setSalaryDaysPerMonth(req.salaryDaysPerMonth());
        policies.save(p);
        audit.record("ExitPolicy", p.getId(), "UPDATED", BeanMapper.toRecord(p, PolicyResponse.class));
        return BeanMapper.toRecord(p, PolicyResponse.class);
    }

    // ------------------------------------------------------------------ shared helpers (also used by the task / settlement services)
    public ExitPolicy policy() {
        return policies.findAll().stream().findFirst().orElseGet(() -> policies.save(new ExitPolicy()));
    }

    public Resignation find(String id) {
        return resignations.findById(id).orElseThrow(() -> ResourceNotFoundException.of("Resignation", id));
    }

    public ResignationResponse move(Resignation r, ResignationStatus to, String comment) {
        ResignationStatus from = r.getStatus();
        r.setStatus(to);
        if (to == ResignationStatus.COMPLETED) r.setCompletedAt(Instant.now());
        resignations.save(r);
        log(r, from, comment);
        audit.record("Resignation", r.getId(), "STATUS_" + to, from + " -> " + to);
        return toResponse(r);
    }

    public void requireManagerOrHr(Resignation r) {
        String me = CurrentUser.employeeId();
        if (r.getEmployeeId().equals(me)) throw new ForbiddenOperationException("You cannot decide your own resignation");
        if (!CurrentUser.isHr() && (me == null || !me.equals(r.getManagerId()))) throw new ForbiddenOperationException("Only the manager of the employee (or HR) can do this");
    }

    public void requireView(Resignation r) {
        String me = CurrentUser.employeeId();
        if (CurrentUser.hasAnyRole(Role.HR_ADMIN, Role.SUPER_ADMIN, Role.PAYROLL_ADMIN, Role.FINANCE_ADMIN) || (me != null && (me.equals(r.getEmployeeId()) || me.equals(r.getManagerId())))) return;
        throw new ForbiddenOperationException("You cannot view this resignation");
    }

    private void log(Resignation r, ResignationStatus from, String comment) {
        ExitHistory h = new ExitHistory();
        h.setResignationId(r.getId());
        h.setFromStatus(from == null ? null : from.name());
        h.setToStatus(r.getStatus().name());
        h.setComment(comment);
        history.save(h);
    }

    ResignationResponse toResponse(Resignation r) {
        LocalDate lwd = r.getConfirmedLastWorkingDay() != null ? r.getConfirmedLastWorkingDay() : r.getRequestedLastWorkingDay();
        int shortfall = (int) Math.max(0, r.getNoticePeriodDays() - ChronoUnit.DAYS.between(r.getSubmittedOn(), lwd));
        return new ResignationResponse(r.getId(), r.getEmployeeId(), r.getEmployeeName(), r.getManagerId(), r.getDepartmentId(), r.getJoiningDate(), r.getSubmittedOn(),
                r.getRequestedLastWorkingDay(), r.getConfirmedLastWorkingDay(), r.getNoticePeriodDays(), r.getWaiverDays(), shortfall, r.getReason(), r.getStatus().name(),
                r.getManagerComment(), r.getHrComment(), r.getCompletedAt(), r.getCreatedAt());
    }
}
