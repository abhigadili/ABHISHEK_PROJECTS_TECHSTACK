package com.hrportal.timesheet.service;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
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
import com.hrportal.timesheet.client.ProjectClient;
import com.hrportal.timesheet.client.ProjectClient.AllocationCheck;
import com.hrportal.timesheet.dto.TimesheetDtos.EntryRequest;
import com.hrportal.timesheet.dto.TimesheetDtos.EntryResponse;
import com.hrportal.timesheet.dto.TimesheetDtos.HistoryResponse;
import com.hrportal.timesheet.dto.TimesheetDtos.SaveEntriesRequest;
import com.hrportal.timesheet.dto.TimesheetDtos.TimesheetResponse;
import com.hrportal.timesheet.dto.TimesheetDtos.WeeklyTotals;
import com.hrportal.timesheet.entity.Enums.HistoryAction;
import com.hrportal.timesheet.entity.Enums.TimesheetStatus;
import com.hrportal.timesheet.entity.Timesheet;
import com.hrportal.timesheet.entity.TimesheetEmployee;
import com.hrportal.timesheet.entity.TimesheetEntry;
import com.hrportal.timesheet.entity.TimesheetHistory;
import com.hrportal.timesheet.producer.TimesheetEventProducer;
import com.hrportal.timesheet.repository.TimesheetRepositories.EntryRepository;
import com.hrportal.timesheet.repository.TimesheetRepositories.HistoryRepository;
import com.hrportal.timesheet.repository.TimesheetRepositories.TimesheetEmployeeRepository;
import com.hrportal.timesheet.repository.TimesheetRepositories.TimesheetRepository;

import feign.FeignException;

/**
 * Weekly timesheets with project / task hours. Rules: hours are accepted only for projects the employee is allocated to on
 * that date (Feign check against the Project service), at most 24 hours per day across all projects, no duplicate
 * (project, task, day) lines, and an APPROVED or SUBMITTED sheet cannot be edited (reopen / reject first).
 */
@Service
public class TimesheetService {
    private static final Logger log = LoggerFactory.getLogger(TimesheetService.class);
    private static final BigDecimal MAX_PER_DAY = BigDecimal.valueOf(24);
    private static final BigDecimal MAX_PER_WEEK = BigDecimal.valueOf(100);

    private final TimesheetRepository timesheets;
    private final EntryRepository entries;
    private final HistoryRepository history;
    private final TimesheetEmployeeRepository employees;
    private final ProjectClient projectClient;
    private final TimesheetEventProducer producer;
    private final AuditService audit;

    public TimesheetService(TimesheetRepository timesheets, EntryRepository entries, HistoryRepository history, TimesheetEmployeeRepository employees,
                            ProjectClient projectClient, TimesheetEventProducer producer, AuditService audit) {
        this.timesheets = timesheets;
        this.entries = entries;
        this.history = history;
        this.employees = employees;
        this.projectClient = projectClient;
        this.producer = producer;
        this.audit = audit;
    }

    // ------------------------------------------------------------------ entry
    /** Replaces the lines of a week (weekly timesheet entry). */
    @Transactional
    public TimesheetResponse saveEntries(SaveEntriesRequest req) {
        String me = requireEmployee();
        Timesheet ts = timesheets.findByEmployeeIdAndWeekStart(me, req.weekStart()).orElseGet(() -> create(me, req.weekStart()));
        if (ts.getStatus() == TimesheetStatus.SUBMITTED) throw new ConflictException("The timesheet is submitted - wait for the decision or ask the approver to reject it");
        if (ts.getStatus() == TimesheetStatus.APPROVED) throw new ConflictException("The timesheet is approved - ask for a correction (reopen)");
        List<TimesheetEntry> lines = buildAndValidate(me, ts, req.entries());
        entries.deleteByTimesheetId(ts.getId());
        entries.flush();
        entries.saveAll(lines);
        recompute(ts, lines);
        ts.setStatus(TimesheetStatus.DRAFT);
        timesheets.save(ts);
        log(ts, HistoryAction.ENTRIES_SAVED, me, lines.size() + " line(s), " + ts.getTotalHours() + " h");
        return toResponse(ts, lines);
    }

    /** Daily entry: merges one line into the week of its date (creating the week when needed). */
    @Transactional
    public TimesheetResponse saveDay(EntryRequest entry) {
        String me = requireEmployee();
        LocalDate week = entry.workDate().with(DayOfWeek.MONDAY);
        List<EntryRequest> merged = new ArrayList<>();
        timesheets.findByEmployeeIdAndWeekStart(me, week).ifPresent(ts -> entries.findByTimesheetIdOrderByWorkDateAscProjectIdAsc(ts.getId()).stream()
                .filter(e -> !(e.getProjectId().equals(entry.projectId()) && e.getWorkDate().equals(entry.workDate()) && e.getTaskKey().equals(entry.taskId() == null ? "-" : entry.taskId())))
                .forEach(e -> merged.add(new EntryRequest(e.getProjectId(), e.getTaskId(), e.getWorkDate(), e.getHours(), e.isBillable(), e.getDescription()))));
        merged.add(entry);
        return saveEntries(new SaveEntriesRequest(week, merged));
    }

    private List<TimesheetEntry> buildAndValidate(String employeeId, Timesheet ts, List<EntryRequest> requested) {
        LocalDate weekEnd = ts.getWeekStart().plusDays(6);
        LocalDate today = LocalDate.now();
        Map<LocalDate, BigDecimal> perDay = new TreeMap<>();
        Set<String> seen = new HashSet<>();
        Map<String, AllocationCheck> checks = new HashMap<>();
        List<TimesheetEntry> lines = new ArrayList<>();
        BigDecimal week = BigDecimal.ZERO;
        for (EntryRequest r : requested) {
            if (r.workDate().isBefore(ts.getWeekStart()) || r.workDate().isAfter(weekEnd)) throw new BadRequestException("Entry date " + r.workDate() + " is outside the week " + ts.getWeekStart() + " .. " + weekEnd);
            if (r.workDate().isAfter(today)) throw new BadRequestException("Hours cannot be booked for a future date: " + r.workDate());
            String taskKey = r.taskId() == null || r.taskId().isBlank() ? "-" : r.taskId();
            if (!seen.add(r.projectId() + "|" + taskKey + "|" + r.workDate())) throw new BadRequestException("Duplicate line for project " + r.projectId() + " on " + r.workDate());
            AllocationCheck check = checks.computeIfAbsent(r.projectId() + "|" + r.workDate(), k -> allocation(r.projectId(), employeeId, r.workDate()));
            if (!check.allocated()) throw new BadRequestException("You are not allocated to project " + r.projectId() + " on " + r.workDate());
            if (!"ACTIVE".equals(check.projectStatus())) throw new BadRequestException("Project " + r.projectId() + " is " + check.projectStatus() + " - time cannot be booked");
            BigDecimal day = perDay.merge(r.workDate(), r.hours(), BigDecimal::add);
            if (day.compareTo(MAX_PER_DAY) > 0) throw new BadRequestException("More than 24 hours booked on " + r.workDate());
            week = week.add(r.hours());
            TimesheetEntry e = new TimesheetEntry();
            e.setTimesheetId(ts.getId());
            e.setEmployeeId(employeeId);
            e.setProjectId(r.projectId());
            e.setTaskId(taskKey.equals("-") ? null : taskKey);
            e.setTaskKey(taskKey);
            e.setWorkDate(r.workDate());
            e.setHours(r.hours());
            e.setBillable((r.billable() == null || r.billable()) && check.billable());
            e.setProjectManagerId(check.projectManagerId());
            e.setDescription(r.description());
            lines.add(e);
        }
        if (week.compareTo(MAX_PER_WEEK) > 0) throw new BadRequestException("A week cannot exceed " + MAX_PER_WEEK + " hours");
        return lines;
    }

    private AllocationCheck allocation(String projectId, String employeeId, LocalDate date) {
        try {
            return projectClient.check(projectId, employeeId, date.toString());
        } catch (ResourceNotFoundException e) {
            throw new BadRequestException("Unknown project: " + projectId);
        } catch (FeignException e) {
            throw new ServiceUnavailableException("Project service is unavailable - cannot validate allocation");
        }
    }

    private void recompute(Timesheet ts, List<TimesheetEntry> lines) {
        ts.setTotalHours(lines.stream().map(TimesheetEntry::getHours).reduce(BigDecimal.ZERO, BigDecimal::add));
        ts.setBillableHours(lines.stream().filter(TimesheetEntry::isBillable).map(TimesheetEntry::getHours).reduce(BigDecimal.ZERO, BigDecimal::add));
    }

    // ------------------------------------------------------------------ workflow
    @Transactional
    public TimesheetResponse submit(LocalDate weekStart) {
        String me = requireEmployee();
        Timesheet ts = timesheets.findByEmployeeIdAndWeekStart(me, weekStart).orElseThrow(() -> new BadRequestException("No timesheet exists for the week of " + weekStart));
        if (ts.getStatus() == TimesheetStatus.SUBMITTED || ts.getStatus() == TimesheetStatus.APPROVED) throw new ConflictException("The timesheet is already " + ts.getStatus());
        List<TimesheetEntry> lines = entries.findByTimesheetIdOrderByWorkDateAscProjectIdAsc(ts.getId());
        if (lines.isEmpty() || ts.getTotalHours().signum() <= 0) throw new BadRequestException("An empty timesheet cannot be submitted");
        // re-validate allocation at submission time (allocations may have ended since the lines were saved)
        List<EntryRequest> again = lines.stream().map(e -> new EntryRequest(e.getProjectId(), e.getTaskId(), e.getWorkDate(), e.getHours(), e.isBillable(), e.getDescription())).toList();
        buildAndValidate(me, ts, again);
        boolean resubmission = ts.getStatus() == TimesheetStatus.REJECTED || ts.getResubmissionCount() > 0 || ts.getDecidedAt() != null;
        ts.setStatus(TimesheetStatus.SUBMITTED);
        ts.setSubmittedAt(Instant.now());
        ts.setApproverId(employees.findById(me).map(TimesheetEmployee::getManagerId).orElse(null));
        ts.setDecisionComment(null);
        ts.setDecidedAt(null);
        if (resubmission) ts.setResubmissionCount(ts.getResubmissionCount() + 1);
        timesheets.save(ts);
        log(ts, resubmission ? HistoryAction.RESUBMITTED : HistoryAction.SUBMITTED, me, null);
        producer.submitted(ts);
        Set<String> approvers = new LinkedHashSet<>();
        if (ts.getApproverId() != null) approvers.add(ts.getApproverId());
        lines.stream().map(TimesheetEntry::getProjectManagerId).filter(java.util.Objects::nonNull).forEach(approvers::add);
        approvers.remove(me);
        approvers.forEach(a -> producer.notify(a, "TIMESHEET_SUBMITTED", ts, null));
        audit.record("Timesheet", ts.getId(), resubmission ? "RESUBMITTED" : "SUBMITTED", ts.getTotalHours() + " h");
        return toResponse(ts, lines);
    }

    @Transactional
    public TimesheetResponse approve(String id, String comment) {
        Timesheet ts = find(id);
        List<TimesheetEntry> lines = entries.findByTimesheetIdOrderByWorkDateAscProjectIdAsc(id);
        requireApprover(ts, lines);
        if (ts.getStatus() != TimesheetStatus.SUBMITTED) throw new BadRequestException("Only a SUBMITTED timesheet can be approved");
        ts.setStatus(TimesheetStatus.APPROVED);
        ts.setApproverId(CurrentUser.employeeId());
        ts.setDecisionComment(comment);
        ts.setDecidedAt(Instant.now());
        timesheets.save(ts);
        log(ts, HistoryAction.APPROVED, CurrentUser.employeeId(), comment);
        producer.approved(ts);
        producer.notify(ts.getEmployeeId(), "TIMESHEET_APPROVED", ts, comment);
        audit.record("Timesheet", id, "APPROVED", comment);
        return toResponse(ts, lines);
    }

    @Transactional
    public TimesheetResponse reject(String id, String comment) {
        Timesheet ts = find(id);
        List<TimesheetEntry> lines = entries.findByTimesheetIdOrderByWorkDateAscProjectIdAsc(id);
        requireApprover(ts, lines);
        if (ts.getStatus() != TimesheetStatus.SUBMITTED) throw new BadRequestException("Only a SUBMITTED timesheet can be rejected");
        if (comment == null || comment.isBlank()) throw new BadRequestException("A reason is required to reject a timesheet");
        ts.setStatus(TimesheetStatus.REJECTED);
        ts.setDecisionComment(comment);
        ts.setDecidedAt(Instant.now());
        timesheets.save(ts);
        log(ts, HistoryAction.REJECTED, CurrentUser.employeeId(), comment);
        producer.notify(ts.getEmployeeId(), "TIMESHEET_REJECTED", ts, comment);
        audit.record("Timesheet", id, "REJECTED", comment);
        return toResponse(ts, lines);
    }

    /** Timesheet correction: an approved sheet is reopened (back to DRAFT) by an approver / HR with a reason. */
    @Transactional
    public TimesheetResponse reopen(String id, String reason) {
        Timesheet ts = find(id);
        List<TimesheetEntry> lines = entries.findByTimesheetIdOrderByWorkDateAscProjectIdAsc(id);
        requireApprover(ts, lines);
        if (ts.getStatus() != TimesheetStatus.APPROVED) throw new BadRequestException("Only an APPROVED timesheet can be reopened");
        ts.setStatus(TimesheetStatus.DRAFT);
        ts.setDecisionComment(reason);
        ts.setResubmissionCount(ts.getResubmissionCount() + 1);
        timesheets.save(ts);
        log(ts, HistoryAction.REOPENED, CurrentUser.employeeId(), reason);
        producer.notify(ts.getEmployeeId(), "TIMESHEET_REOPENED", ts, reason);
        audit.record("Timesheet", id, "REOPENED", reason);
        return toResponse(ts, lines);
    }

    // ------------------------------------------------------------------ queries
    @Transactional(readOnly = true)
    public TimesheetResponse week(LocalDate weekStart) {
        String me = requireEmployee();
        Timesheet ts = timesheets.findByEmployeeIdAndWeekStart(me, weekStart.with(DayOfWeek.MONDAY)).orElseThrow(() -> ResourceNotFoundException.of("Timesheet for week", weekStart));
        return toResponse(ts, entries.findByTimesheetIdOrderByWorkDateAscProjectIdAsc(ts.getId()));
    }

    @Transactional(readOnly = true)
    public WeeklyTotals totals(LocalDate weekStart) {
        TimesheetResponse r = week(weekStart);
        Map<LocalDate, BigDecimal> byDay = new TreeMap<>(r.entries().stream().collect(Collectors.groupingBy(EntryResponse::workDate,
                Collectors.reducing(BigDecimal.ZERO, EntryResponse::hours, BigDecimal::add))));
        return new WeeklyTotals(byDay, r.totalHours());
    }

    @Transactional(readOnly = true)
    public TimesheetResponse get(String id) {
        Timesheet ts = find(id);
        List<TimesheetEntry> lines = entries.findByTimesheetIdOrderByWorkDateAscProjectIdAsc(id);
        requireCanView(ts, lines);
        return toResponse(ts, lines);
    }

    @Transactional(readOnly = true)
    public Page<TimesheetResponse> mine(LocalDate from, LocalDate to, Pageable pageable) {
        return forEmployee(requireEmployee(), from, to, pageable);
    }

    @Transactional(readOnly = true)
    public Page<TimesheetResponse> forEmployee(String employeeId, LocalDate from, LocalDate to, Pageable pageable) {
        if (!CurrentUser.isHr() && !employeeId.equals(CurrentUser.employeeId())) {
            boolean manager = employees.findById(employeeId).map(e -> CurrentUser.employeeId() != null && CurrentUser.employeeId().equals(e.getManagerId())).orElse(false);
            if (!manager) throw new ForbiddenOperationException("You can only view your own or your team's timesheets");
        }
        Page<Timesheet> page = timesheets.findByEmployeeIdAndWeekStartBetween(employeeId, from, to, pageable);
        Map<String, List<TimesheetEntry>> byTs = entries.findByTimesheetIdIn(page.getContent().stream().map(Timesheet::getId).toList()).stream()
                .collect(Collectors.groupingBy(TimesheetEntry::getTimesheetId));
        return page.map(t -> toResponse(t, byTs.getOrDefault(t.getId(), List.of())));
    }

    /** Submitted timesheets waiting for ME: those of my direct reports, those with hours on a project I manage, everything for HR. */
    @Transactional(readOnly = true)
    public List<TimesheetResponse> pending() {
        Map<String, Timesheet> out = new java.util.LinkedHashMap<>();
        String me = CurrentUser.employeeId();
        if (CurrentUser.isHr()) timesheets.findByStatusOrderBySubmittedAtAsc(TimesheetStatus.SUBMITTED).forEach(t -> out.put(t.getId(), t));
        if (me != null) {
            timesheets.findByStatusAndApproverIdOrderBySubmittedAtAsc(TimesheetStatus.SUBMITTED, me).forEach(t -> out.put(t.getId(), t));
            timesheets.findSubmittedForProjectManager(me).forEach(t -> out.put(t.getId(), t));
        }
        Map<String, List<TimesheetEntry>> byTs = entries.findByTimesheetIdIn(out.keySet()).stream().collect(Collectors.groupingBy(TimesheetEntry::getTimesheetId));
        return out.values().stream().filter(t -> !t.getEmployeeId().equals(me)).map(t -> toResponse(t, byTs.getOrDefault(t.getId(), List.of()))).toList();
    }

    @Transactional(readOnly = true)
    public List<HistoryResponse> history(String id) {
        Timesheet ts = find(id);
        requireCanView(ts, entries.findByTimesheetIdOrderByWorkDateAscProjectIdAsc(id));
        return history.findByTimesheetIdOrderByCreatedAtAsc(id).stream().map(h -> new HistoryResponse(h.getId(), h.getTimesheetId(), h.getAction().name(), h.getActorId(), h.getComment(), h.getCreatedAt())).toList();
    }

    // ------------------------------------------------------------------ helpers
    private Timesheet create(String employeeId, LocalDate weekStart) {
        Timesheet t = new Timesheet();
        t.setEmployeeId(employeeId);
        t.setEmployeeName(employees.findById(employeeId).map(TimesheetEmployee::getFullName).orElse(null));
        t.setWeekStart(weekStart);
        t = timesheets.save(t);
        log(t, HistoryAction.CREATED, employeeId, null);
        return t;
    }

    private void requireApprover(Timesheet ts, List<TimesheetEntry> lines) {
        String me = CurrentUser.employeeId();
        if (ts.getEmployeeId().equals(me)) throw new ForbiddenOperationException("You cannot decide your own timesheet");
        if (CurrentUser.isHr()) return;
        boolean manager = me != null && employees.findById(ts.getEmployeeId()).map(e -> me.equals(e.getManagerId())).orElse(false);
        boolean projectManager = me != null && lines.stream().anyMatch(l -> me.equals(l.getProjectManagerId()));
        if (!manager && !projectManager) throw new ForbiddenOperationException("Only the employee's manager or a project manager of the booked projects can decide");
    }

    private void requireCanView(Timesheet ts, List<TimesheetEntry> lines) {
        String me = CurrentUser.employeeId();
        if (ts.getEmployeeId().equals(me) || CurrentUser.isHr()) return;
        boolean manager = me != null && employees.findById(ts.getEmployeeId()).map(e -> me.equals(e.getManagerId())).orElse(false);
        boolean pm = me != null && lines.stream().anyMatch(l -> me.equals(l.getProjectManagerId()));
        if (!manager && !pm) throw new ForbiddenOperationException("You cannot view this timesheet");
    }

    private void log(Timesheet ts, HistoryAction action, String actor, String comment) {
        TimesheetHistory h = new TimesheetHistory();
        h.setTimesheetId(ts.getId());
        h.setAction(action);
        h.setActorId(actor);
        h.setComment(comment);
        history.save(h);
    }

    private Timesheet find(String id) {
        return timesheets.findById(id).orElseThrow(() -> ResourceNotFoundException.of("Timesheet", id));
    }

    private static String requireEmployee() {
        String me = CurrentUser.employeeId();
        if (me == null) throw new ForbiddenOperationException("Your account is not linked to an employee record");
        return me;
    }

    private TimesheetResponse toResponse(Timesheet t, List<TimesheetEntry> lines) {
        return new TimesheetResponse(t.getId(), t.getEmployeeId(), t.getEmployeeName(), t.getWeekStart(), t.getStatus().name(), t.getTotalHours(), t.getBillableHours(),
                t.getSubmittedAt(), t.getApproverId(), t.getDecisionComment(), t.getDecidedAt(), t.getResubmissionCount(),
                BeanMapper.toRecords(lines, EntryResponse.class));
    }
}
