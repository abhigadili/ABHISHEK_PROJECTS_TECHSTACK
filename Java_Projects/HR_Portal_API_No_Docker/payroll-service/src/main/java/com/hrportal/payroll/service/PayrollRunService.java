package com.hrportal.payroll.service;

import java.time.Duration;
import java.time.Instant;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import com.hrportal.common.audit.AuditService;
import com.hrportal.common.cache.DistributedLockService;
import com.hrportal.common.exception.BadRequestException;
import com.hrportal.common.exception.ConflictException;
import com.hrportal.common.exception.ForbiddenOperationException;
import com.hrportal.common.exception.ResourceNotFoundException;
import com.hrportal.common.exception.ValidationException;
import com.hrportal.common.persistence.BeanMapper;
import com.hrportal.common.security.CurrentUser;
import com.hrportal.payroll.dto.PayrollDtos.EntryResponse;
import com.hrportal.payroll.dto.PayrollDtos.LineResponse;
import com.hrportal.payroll.dto.PayrollDtos.RunRequest;
import com.hrportal.payroll.dto.PayrollDtos.RunResponse;
import com.hrportal.payroll.engine.PayrollModel.Input;
import com.hrportal.payroll.engine.PayrollModel.Line;
import com.hrportal.payroll.engine.PayrollModel.Result;
import com.hrportal.payroll.engine.PayrollModel.StructureItem;
import com.hrportal.payroll.engine.PayrollSettings;
import com.hrportal.payroll.engine.SalaryCalculationEngine;
import com.hrportal.payroll.entity.Adjustment;
import com.hrportal.payroll.entity.EmployeeSalary;
import com.hrportal.payroll.entity.Enums.RunStatus;
import com.hrportal.payroll.entity.Loan;
import com.hrportal.payroll.entity.LoanDeduction;
import com.hrportal.payroll.entity.PayrollEntry;
import com.hrportal.payroll.entity.PayrollEntryLine;
import com.hrportal.payroll.entity.PayrollRun;
import com.hrportal.payroll.entity.SalaryComponent;
import com.hrportal.payroll.entity.SalaryStructureComponent;
import com.hrportal.payroll.producer.PayrollEventProducer;
import com.hrportal.payroll.repository.PayrollRepositories.AdjustmentRepository;
import com.hrportal.payroll.repository.PayrollRepositories.ComponentRepository;
import com.hrportal.payroll.repository.PayrollRepositories.EmployeeSalaryRepository;
import com.hrportal.payroll.repository.PayrollRepositories.EntryRepository;
import com.hrportal.payroll.repository.PayrollRepositories.LineRepository;
import com.hrportal.payroll.repository.PayrollRepositories.LoanDeductionRepository;
import com.hrportal.payroll.repository.PayrollRepositories.LoanRepository;
import com.hrportal.payroll.repository.PayrollRepositories.RunRepository;
import com.hrportal.payroll.repository.PayrollRepositories.StructureComponentRepository;

/**
 * Monthly payroll workflow: create -> process -> approve -> finalize.
 * process: 1) gather inputs for all employees concurrently (HTTP, outside any transaction), 2) compute with the engine,
 * 3) in ONE database transaction store entries + lines (JdbcTemplate batchUpdate), loan deductions and call the stored
 * procedure sp_process_monthly_payroll, which re-aggregates the totals, applies loan recoveries and adjustments and marks the run PROCESSED.
 * If any employee cannot be computed nothing is stored and the whole run reports every failing employee.
 */
@Service
public class PayrollRunService {
    private static final Logger log = LoggerFactory.getLogger(PayrollRunService.class);

    private final RunRepository runs;
    private final EntryRepository entries;
    private final LineRepository lines;
    private final EmployeeSalaryRepository salaries;
    private final StructureComponentRepository structureLines;
    private final ComponentRepository components;
    private final AdjustmentRepository adjustments;
    private final LoanRepository loans;
    private final LoanDeductionRepository loanDeductions;
    private final PayrollConfigService config;
    private final PayrollInputGatherer gatherer;
    private final SalaryCalculationEngine engine;
    private final PayslipService payslips;
    private final PayrollEventProducer producer;
    private final DistributedLockService locks;
    private final TransactionTemplate tx;
    private final JdbcTemplate jdbc;
    private final AuditService audit;

    public PayrollRunService(RunRepository runs, EntryRepository entries, LineRepository lines, EmployeeSalaryRepository salaries, StructureComponentRepository structureLines,
                             ComponentRepository components, AdjustmentRepository adjustments, LoanRepository loans, LoanDeductionRepository loanDeductions,
                             PayrollConfigService config, PayrollInputGatherer gatherer, SalaryCalculationEngine engine, PayslipService payslips,
                             PayrollEventProducer producer, DistributedLockService locks, TransactionTemplate tx, JdbcTemplate jdbc, AuditService audit) {
        this.runs = runs;
        this.entries = entries;
        this.lines = lines;
        this.salaries = salaries;
        this.structureLines = structureLines;
        this.components = components;
        this.adjustments = adjustments;
        this.loans = loans;
        this.loanDeductions = loanDeductions;
        this.config = config;
        this.gatherer = gatherer;
        this.engine = engine;
        this.payslips = payslips;
        this.producer = producer;
        this.locks = locks;
        this.tx = tx;
        this.jdbc = jdbc;
        this.audit = audit;
    }

    @Transactional
    public RunResponse create(RunRequest req) {
        YearMonth month = YearMonth.parse(req.month());
        if (month.isAfter(YearMonth.now())) throw new BadRequestException("A payroll run cannot be created for a future month");
        if (runs.findByPayrollMonth(req.month()).isPresent()) throw new ConflictException("A payroll run already exists for " + req.month());
        PayrollRun r = new PayrollRun();
        r.setPayrollMonth(req.month());
        r.setNote(req.note());
        r = runs.save(r);
        audit.record("PayrollRun", r.getId(), "CREATED", req.month());
        return toResponse(r);
    }

    @Transactional
    public void deleteDraft(String id) {
        PayrollRun r = find(id);
        if (r.getStatus() != RunStatus.DRAFT) throw new BadRequestException("Only a DRAFT run can be deleted");
        runs.delete(r);
        audit.record("PayrollRun", id, "DELETED", r.getPayrollMonth());
    }

    // ------------------------------------------------------------------ process
    public RunResponse process(String runId) {
        PayrollRun run = find(runId);
        if (run.getStatus() != RunStatus.DRAFT) throw new BadRequestException("Only a DRAFT run can be processed (current: " + run.getStatus() + ")");
        return locks.withLock("payroll-run:" + run.getPayrollMonth(), Duration.ofMinutes(10), () -> doProcess(run));
    }

    private RunResponse doProcess(PayrollRun run) {
        String month = run.getPayrollMonth();
        YearMonth ym = YearMonth.parse(month);
        List<EmployeeSalary> population = salaries.findInForce(ym.atDay(1), ym.atEndOfMonth());
        if (population.isEmpty()) throw new BadRequestException("No employee salaries are in force for " + month);

        // -------- reference data (read once)
        PayrollSettings settings = config.settings();
        Map<String, SalaryComponent> componentById = components.findAll().stream().collect(Collectors.toMap(SalaryComponent::getId, c -> c));
        Map<String, List<StructureItem>> structures = new HashMap<>();
        for (String structureId : population.stream().map(EmployeeSalary::getStructureId).distinct().toList()) {
            List<StructureItem> items = new ArrayList<>();
            for (SalaryStructureComponent l : structureLines.findByStructureId(structureId)) {
                SalaryComponent c = componentById.get(l.getComponentId());
                if (c != null && c.isActive()) items.add(new StructureItem(c.getCode(), c.getName(), c.getType(), c.getCalcType(), l.getValue(), c.getDisplayOrder()));
            }
            structures.put(structureId, items);
        }
        Map<String, List<Adjustment>> adjByEmployee = adjustments.findPendingForMonth(month).stream().collect(Collectors.groupingBy(Adjustment::getEmployeeId));
        Map<String, List<Loan>> loanByEmployee = loans.findActiveStartedBy(month).stream().collect(Collectors.groupingBy(Loan::getEmployeeId));

        // -------- gather concurrently (HTTP calls - no database transaction is open here)
        Map<String, CompletableFuture<Input>> futures = new LinkedHashMap<>();
        for (EmployeeSalary s : population) {
            futures.put(s.getEmployeeId(), gatherer.gather(month, s, structures.get(s.getStructureId()), adjByEmployee.getOrDefault(s.getEmployeeId(), List.of()),
                    loanByEmployee.getOrDefault(s.getEmployeeId(), List.of()), settings));
        }
        CompletableFuture.allOf(futures.values().toArray(new CompletableFuture[0])).handle((v, ex) -> null).join();

        // -------- compute; collect every failure
        Map<String, String> errors = new LinkedHashMap<>();
        Map<String, Result> results = new LinkedHashMap<>();
        Map<String, Input> inputs = new HashMap<>();
        futures.forEach((employeeId, f) -> {
            try {
                Input in = f.join();
                if (in.employee().status() != null && in.employee().status().equals("TERMINATED") && in.attendance().workingDays() == 0) {
                    throw new IllegalStateException("employee is terminated and has no working days in the month");
                }
                inputs.put(employeeId, in);
                results.put(employeeId, engine.calculate(in));
            } catch (RuntimeException e) {
                Throwable cause = e.getCause() != null ? e.getCause() : e;
                errors.put(employeeId, cause.getMessage() == null ? cause.getClass().getSimpleName() : cause.getMessage());
            }
        });
        if (!errors.isEmpty()) {
            log.warn("Payroll {} not processed: {} employee(s) failed", month, errors.size());
            throw new ValidationException("Payroll could not be processed for " + errors.size() + " employee(s) - nothing was stored", errors);
        }

        // -------- persist everything atomically
        String user = CurrentUser.auditName();
        tx.executeWithoutResult(s -> persist(run.getId(), month, user, inputs, results));
        PayrollRun done = find(run.getId());
        audit.record("PayrollRun", done.getId(), "PROCESSED", done.getEmployeeCount() + " employees, net " + done.getTotalNet());
        log.info("Payroll {} processed: {} employees, gross {}, net {}", month, done.getEmployeeCount(), done.getTotalGross(), done.getTotalNet());
        return toResponse(done);
    }

    private void persist(String runId, String month, String user, Map<String, Input> inputs, Map<String, Result> results) {
        entries.deleteByRunId(runId);
        List<PayrollEntry> toSave = new ArrayList<>();
        for (Map.Entry<String, Result> e : results.entrySet()) {
            Input in = inputs.get(e.getKey());
            Result r = e.getValue();
            PayrollEntry pe = new PayrollEntry();
            pe.setRunId(runId);
            pe.setPayrollMonth(month);
            pe.setEmployeeId(e.getKey());
            pe.setEmployeeName(in.employee().fullName());
            pe.setEmployeeCode(in.employee().employeeCode());
            pe.setDepartmentId(in.employee().departmentId());
            pe.setSalaryId(in.salary().getId());
            pe.setWorkingDays(r.workingDays());
            pe.setPaidDays(r.paidDays());
            pe.setLopDays(r.lopDays());
            pe.setOvertimeMinutes(r.overtimeMinutes());
            pe.setGross(r.gross());
            pe.setDeductions(r.deductions());
            pe.setNet(r.net());
            toSave.add(pe);
        }
        entries.saveAll(toSave);
        entries.flush();
        // lines: JDBC batch insert (one round trip per batch instead of one INSERT per line)
        List<Object[]> batch = new ArrayList<>();
        for (PayrollEntry pe : toSave) {
            for (Line l : results.get(pe.getEmployeeId()).lines()) {
                batch.add(new Object[]{java.util.UUID.randomUUID().toString(), pe.getId(), l.code(), l.name(), l.type().name(), l.amount(), l.note(), user, user});
            }
        }
        jdbc.batchUpdate("INSERT INTO payroll_entry_lines (id, entry_id, component_code, component_name, type, amount, note, created_at, updated_at, created_by, updated_by) "
                + "VALUES (?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), ?, ?)", batch);
        List<LoanDeduction> recoveries = new ArrayList<>();
        for (PayrollEntry pe : toSave) {
            results.get(pe.getEmployeeId()).loanRecoveries().forEach(lr -> {
                LoanDeduction d = new LoanDeduction();
                d.setLoanId(lr.loanId());
                d.setRunId(runId);
                d.setEmployeeId(pe.getEmployeeId());
                d.setAmount(lr.amount());
                recoveries.add(d);
            });
        }
        loanDeductions.deleteByRunId(runId);
        loanDeductions.saveAll(recoveries);
        loanDeductions.flush();
        jdbc.update("CALL sp_process_monthly_payroll(?, ?)", runId, user);      // totals, loan balances, adjustments, status = PROCESSED
    }

    // ------------------------------------------------------------------ approve / finalize
    @Transactional
    public RunResponse approve(String runId) {
        PayrollRun r = find(runId);
        if (r.getStatus() != RunStatus.PROCESSED) throw new BadRequestException("Only a PROCESSED run can be approved (current: " + r.getStatus() + ")");
        if (CurrentUser.auditName().equals(r.getProcessedBy())) throw new ForbiddenOperationException("The person who processed the run cannot approve it (maker-checker)");
        r.setStatus(RunStatus.APPROVED);
        r.setApprovedAt(Instant.now());
        r.setApprovedBy(CurrentUser.auditName());
        runs.save(r);
        audit.record("PayrollRun", runId, "APPROVED", r.getPayrollMonth());
        return toResponse(r);
    }

    public RunResponse finalizeRun(String runId) {
        RunResponse out = tx.execute(s -> {
            PayrollRun r = find(runId);
            if (r.getStatus() != RunStatus.APPROVED) throw new BadRequestException("Only an APPROVED run can be finalized (current: " + r.getStatus() + ")");
            r.setStatus(RunStatus.FINALIZED);
            r.setFinalizedAt(Instant.now());
            r.setFinalizedBy(CurrentUser.auditName());
            runs.save(r);
            List<PayrollEntry> list = entries.findByRunId(runId);
            producer.processed(r, list);
            list.forEach(e -> producer.payrollCompleted(r, e));
            audit.record("PayrollRun", runId, "FINALIZED", r.getPayrollMonth());
            return toResponse(r);
        });
        payslips.generateForRun(runId);
        return out;
    }

    // ------------------------------------------------------------------ queries
    @Transactional(readOnly = true)
    public RunResponse get(String id) {
        return toResponse(find(id));
    }

    @Transactional(readOnly = true)
    public Page<RunResponse> list(Pageable pageable) {
        return runs.findAllByOrderByPayrollMonthDesc(pageable).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public Page<EntryResponse> entries(String runId, Pageable pageable) {
        find(runId);
        Page<PayrollEntry> page = entries.findByRunId(runId, pageable);
        Map<String, List<PayrollEntryLine>> byEntry = lines.findByEntryIdIn(page.getContent().stream().map(PayrollEntry::getId).toList()).stream()
                .collect(Collectors.groupingBy(PayrollEntryLine::getEntryId));
        return page.map(e -> toEntry(e, byEntry.getOrDefault(e.getId(), List.of())));
    }

    @Transactional(readOnly = true)
    public EntryResponse entry(String entryId) {
        PayrollEntry e = entries.findById(entryId).orElseThrow(() -> ResourceNotFoundException.of("Payroll entry", entryId));
        return toEntry(e, lines.findByEntryId(entryId));
    }

    private EntryResponse toEntry(PayrollEntry e, List<PayrollEntryLine> ls) {
        List<LineResponse> out = ls.stream().map(l -> new LineResponse(l.getComponentCode(), l.getComponentName(), l.getType().name(), l.getAmount(), l.getNote()))
                .sorted(java.util.Comparator.comparing(LineResponse::type).thenComparing(LineResponse::componentCode)).toList();
        return new EntryResponse(e.getId(), e.getRunId(), e.getPayrollMonth(), e.getEmployeeId(), e.getEmployeeName(), e.getEmployeeCode(), e.getDepartmentId(), e.getWorkingDays(),
                e.getPaidDays(), e.getLopDays(), e.getOvertimeMinutes(), e.getGross(), e.getDeductions(), e.getNet(), out);
    }

    private PayrollRun find(String id) {
        return runs.findById(id).orElseThrow(() -> ResourceNotFoundException.of("Payroll run", id));
    }

    private RunResponse toResponse(PayrollRun r) {
        return BeanMapper.toRecord(r, RunResponse.class);
    }
}
