package com.hrportal.leave.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Types;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.SqlParameter;
import org.springframework.jdbc.core.simple.SimpleJdbcCall;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hrportal.common.audit.AuditService;
import com.hrportal.common.cache.CacheEvictor;
import com.hrportal.common.exception.BadRequestException;
import com.hrportal.common.persistence.BeanMapper;
import com.hrportal.common.security.CurrentUser;
import com.hrportal.leave.dto.LeaveDtos.AdjustmentRequest;
import com.hrportal.leave.dto.LeaveDtos.BalanceHistoryResponse;
import com.hrportal.leave.dto.LeaveDtos.BalanceResponse;
import com.hrportal.leave.dto.LeaveDtos.EncashRequest;
import com.hrportal.leave.dto.LeaveDtos.EncashableResponse;
import com.hrportal.leave.dto.LeaveDtos.EntitlementDto;
import com.hrportal.leave.dto.LeaveDtos.LeaveTypeResponse;
import com.hrportal.leave.dto.LeaveDtos.PolicyResponse;
import com.hrportal.leave.dto.LeaveDtos.ReconciledBalance;
import com.hrportal.leave.dto.LeaveDtos.RunResult;
import com.hrportal.leave.entity.LeaveBalance;
import com.hrportal.leave.entity.LeaveBalanceId;
import com.hrportal.leave.entity.LeaveEmployee;
import com.hrportal.leave.entity.LeaveRunLog;
import com.hrportal.leave.repository.LeaveRepositories.BalanceHistoryRepository;
import com.hrportal.leave.repository.LeaveRepositories.LeaveBalanceRepository;
import com.hrportal.leave.repository.LeaveRepositories.LeaveEmployeeRepository;
import com.hrportal.leave.repository.LeaveRepositories.RunLogRepository;
import com.hrportal.leave.service.LeaveCatalogService.LeavePolicyService;
import com.hrportal.leave.service.LeaveCatalogService.LeaveTypeService;

/** Leave balances: reads (Redis cached), reservation / consumption inside workflows, accrual, carry-forward, adjustment, encashment. */
@Service
public class LeaveBalanceService {
    private static final Logger log = LoggerFactory.getLogger(LeaveBalanceService.class);

    private final LeaveBalanceRepository balances;
    private final BalanceHistoryRepository history;
    private final LeaveEmployeeRepository employees;
    private final RunLogRepository runLog;
    private final LeaveTypeService types;
    private final LeavePolicyService policies;
    private final AuditService audit;
    private final CacheEvictor cache;
    private final SimpleJdbcCall reconcileCall;

    public LeaveBalanceService(LeaveBalanceRepository balances, BalanceHistoryRepository history, LeaveEmployeeRepository employees,
                               RunLogRepository runLog, LeaveTypeService types, LeavePolicyService policies, AuditService audit,
                               CacheEvictor cache, JdbcTemplate jdbc) {
        this.balances = balances;
        this.history = history;
        this.employees = employees;
        this.runLog = runLog;
        this.types = types;
        this.policies = policies;
        this.audit = audit;
        this.cache = cache;
        // stored procedure call without database metadata look-up: parameters are declared explicitly
        this.reconcileCall = new SimpleJdbcCall(jdbc).withProcedureName("sp_calculate_leave_balance").withoutProcedureColumnMetaDataAccess()
                .declareParameters(new SqlParameter("p_employee_id", Types.VARCHAR), new SqlParameter("p_year", Types.INTEGER))
                .returningResultSet("rows", (rs, i) -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("leaveTypeId", rs.getString("leave_type_id"));
                    m.put("leaveTypeCode", rs.getString("leave_type_code"));
                    m.put("entitled", rs.getBigDecimal("entitled"));
                    m.put("usedRecorded", rs.getBigDecimal("used_recorded"));
                    m.put("usedFromApplications", rs.getBigDecimal("used_from_applications"));
                    m.put("pendingRecorded", rs.getBigDecimal("pending_recorded"));
                    m.put("pendingFromApplications", rs.getBigDecimal("pending_from_applications"));
                    m.put("available", rs.getBigDecimal("available"));
                    return m;
                });
    }

    // ------------------------------------------------------------------ reads
    @Transactional(readOnly = true)
    @Cacheable(cacheNames = "leaveBalance", key = "#employeeId + ':' + #year")
    public List<BalanceResponse> balances(String employeeId, int year) {
        Map<String, LeaveTypeResponse> typeMap = types.byId();
        List<BalanceResponse> out = new ArrayList<>();
        for (LeaveBalance b : balances.findForEmployee(employeeId, year)) {
            LeaveTypeResponse t = typeMap.get(b.getId().getLeaveTypeId());
            out.add(new BalanceResponse(b.getId().getLeaveTypeId(), t == null ? null : t.code(), t == null ? null : t.name(), year, b.getOpening(), b.getAccrued(),
                    b.getCarriedForward(), b.getAdjusted(), b.getUsed(), b.getPending(), b.getEncashed(), b.available()));
        }
        out.sort(java.util.Comparator.comparing(x -> String.valueOf(x.leaveTypeCode())));
        return out;
    }

    @Transactional(readOnly = true)
    public Page<BalanceHistoryResponse> history(String employeeId, int year, Pageable pageable) {
        return history.findByEmployeeIdAndBalanceYear(employeeId, year, pageable).map(h -> BeanMapper.toRecord(h, BalanceHistoryResponse.class));
    }

    /** Runs the stored procedure sp_calculate_leave_balance and compares recorded figures with the application ledger. */
    @Transactional(readOnly = true)
    @SuppressWarnings("unchecked")
    public List<ReconciledBalance> reconcile(String employeeId, int year) {
        Map<String, Object> result = reconcileCall.execute(Map.of("p_employee_id", employeeId, "p_year", year));
        List<Map<String, Object>> rows = (List<Map<String, Object>>) result.getOrDefault("rows", List.of());
        List<ReconciledBalance> out = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            BigDecimal usedRec = (BigDecimal) r.get("usedRecorded"), usedApp = (BigDecimal) r.get("usedFromApplications");
            BigDecimal penRec = (BigDecimal) r.get("pendingRecorded"), penApp = (BigDecimal) r.get("pendingFromApplications");
            out.add(new ReconciledBalance((String) r.get("leaveTypeId"), (String) r.get("leaveTypeCode"), (BigDecimal) r.get("entitled"), usedRec, usedApp,
                    penRec, penApp, (BigDecimal) r.get("available"), usedRec.compareTo(usedApp) == 0 && penRec.compareTo(penApp) == 0));
        }
        return out;
    }

    // ------------------------------------------------------------------ workflow operations (caller owns the transaction)
    /** Locks the balance row (SELECT ... FOR UPDATE) - throws when the employee has no balance for that type / year. */
    public LeaveBalance lock(String employeeId, String leaveTypeId, int year) {
        return balances.lockById(new LeaveBalanceId(employeeId, leaveTypeId, year))
                .orElseThrow(() -> new BadRequestException("No leave balance exists for this leave type in " + year));
    }

    public void reserve(String employeeId, String leaveTypeId, int year, BigDecimal days) {
        LeaveBalance b = lock(employeeId, leaveTypeId, year);
        if (b.available().compareTo(days) < 0) {
            throw new BadRequestException("Insufficient leave balance: available " + b.available().toPlainString() + ", requested " + days.toPlainString());
        }
        b.setPending(b.getPending().add(days));
        balances.save(b);
        evict(employeeId, year);
    }

    public void releasePending(String employeeId, String leaveTypeId, int year, BigDecimal days) {
        LeaveBalance b = lock(employeeId, leaveTypeId, year);
        b.setPending(b.getPending().subtract(days).max(BigDecimal.ZERO));
        balances.save(b);
        evict(employeeId, year);
    }

    public void commitUsed(String employeeId, String leaveTypeId, int year, BigDecimal days) {
        LeaveBalance b = lock(employeeId, leaveTypeId, year);
        b.setPending(b.getPending().subtract(days).max(BigDecimal.ZERO));
        b.setUsed(b.getUsed().add(days));
        balances.save(b);
        evict(employeeId, year);
    }

    public void restoreUsed(String employeeId, String leaveTypeId, int year, BigDecimal days) {
        LeaveBalance b = lock(employeeId, leaveTypeId, year);
        b.setUsed(b.getUsed().subtract(days).max(BigDecimal.ZERO));
        balances.save(b);
        evict(employeeId, year);
    }

    // ------------------------------------------------------------------ initialisation, accrual, carry-forward
    /** Creates the yearly balances of an employee from the default policy (idempotent: existing rows are left alone). */
    @Transactional
    public int initialise(LeaveEmployee e, int year) {
        PolicyResponse policy = policies.defaultPolicy();
        int created = 0;
        for (EntitlementDto ent : policy.entitlements()) {
            LeaveBalanceId id = new LeaveBalanceId(e.getEmployeeId(), ent.leaveTypeId(), year);
            if (balances.existsById(id)) continue;
            LeaveBalance b = new LeaveBalance(id);
            if (ent.accrualPerMonth().signum() == 0) {
                b.setOpening(ent.annualDays());                                // upfront grant (maternity, paternity ...)
            } else {
                b.setAccrued(accruedUntilNow(e, ent, year));                   // pro-rated for the months already elapsed
            }
            balances.save(b);
            created++;
        }
        if (created > 0) evict(e.getEmployeeId(), year);
        return created;
    }

    private BigDecimal accruedUntilNow(LeaveEmployee e, EntitlementDto ent, int year) {
        YearMonth start = YearMonth.of(year, 1);
        if (e.getJoiningDate() != null && e.getJoiningDate().getYear() == year) start = YearMonth.from(e.getJoiningDate());
        YearMonth end = year == LocalDate.now().getYear() ? YearMonth.now() : YearMonth.of(year, 12);
        long months = Math.max(0, java.time.temporal.ChronoUnit.MONTHS.between(start, end) + 1);
        return ent.accrualPerMonth().multiply(BigDecimal.valueOf(months)).min(ent.annualDays()).setScale(2, RoundingMode.HALF_UP);
    }

    /** Monthly accrual for all active employees. Runs once per month (leave_run_log key), also triggered by the scheduler. */
    @Transactional
    public RunResult accrueMonth(YearMonth month) {
        String key = "ACCRUAL:" + month;
        if (runLog.existsById(key)) return new RunResult(key, 0, true);
        PolicyResponse policy = policies.defaultPolicy();
        int processed = 0;
        for (LeaveEmployee e : employees.findByStatusIn(List.of("ACTIVE", "ON_NOTICE"))) {
            if (e.getJoiningDate() != null && YearMonth.from(e.getJoiningDate()).isAfter(month)) continue;
            for (EntitlementDto ent : policy.entitlements()) {
                if (ent.accrualPerMonth().signum() == 0) continue;
                LeaveBalanceId id = new LeaveBalanceId(e.getEmployeeId(), ent.leaveTypeId(), month.getYear());
                LeaveBalance b = balances.lockById(id).orElseGet(() -> new LeaveBalance(id));
                BigDecimal room = ent.annualDays().subtract(b.getAccrued());
                BigDecimal add = ent.accrualPerMonth().min(room.max(BigDecimal.ZERO));
                if (add.signum() > 0) {
                    b.setAccrued(b.getAccrued().add(add));
                    balances.save(b);
                    processed++;
                }
            }
            evict(e.getEmployeeId(), month.getYear());
        }
        finishRun(key, processed);
        audit.record("LeaveAccrual", key, "ACCRUAL_RUN", java.util.Map.of("records", processed));
        log.info("Leave accrual {} processed {} balance rows", month, processed);
        return new RunResult(key, processed, false);
    }

    /** Year-end carry-forward: unused days up to the policy cap move to the next year's carriedForward. */
    @Transactional
    public RunResult carryForward(int fromYear) {
        String key = "CARRY:" + fromYear;
        if (runLog.existsById(key)) return new RunResult(key, 0, true);
        PolicyResponse policy = policies.defaultPolicy();
        Map<String, EntitlementDto> rules = new HashMap<>();
        policy.entitlements().forEach(en -> rules.put(en.leaveTypeId(), en));
        int processed = 0;
        for (LeaveBalance from : balances.findAllForYear(fromYear)) {
            EntitlementDto rule = rules.get(from.getId().getLeaveTypeId());
            if (rule == null || rule.carryForwardMax().signum() == 0) continue;
            BigDecimal carry = from.available().min(rule.carryForwardMax()).max(BigDecimal.ZERO);
            if (carry.signum() == 0) continue;
            LeaveBalanceId nextId = new LeaveBalanceId(from.getId().getEmployeeId(), from.getId().getLeaveTypeId(), fromYear + 1);
            LeaveBalance next = balances.lockById(nextId).orElseGet(() -> new LeaveBalance(nextId));
            next.setCarriedForward(carry);
            balances.save(next);
            evict(from.getId().getEmployeeId(), fromYear + 1);
            processed++;
        }
        finishRun(key, processed);
        audit.record("LeaveCarryForward", key, "CARRY_FORWARD_RUN", java.util.Map.of("records", processed));
        return new RunResult(key, processed, false);
    }

    private void finishRun(String key, int processed) {
        LeaveRunLog r = new LeaveRunLog();
        r.setRunKey(key);
        r.setRecordsProcessed(processed);
        r.setExecutedBy(CurrentUser.auditName());
        runLog.save(r);
    }

    // ------------------------------------------------------------------ HR actions
    @Transactional
    public BalanceResponse adjust(String employeeId, AdjustmentRequest req) {
        LeaveBalanceId id = new LeaveBalanceId(employeeId, req.leaveTypeId(), req.year());
        LeaveBalance b = balances.lockById(id).orElseGet(() -> new LeaveBalance(id));
        BigDecimal before = b.getAdjusted();
        b.setAdjusted(before.add(req.days()));
        if (b.available().signum() < 0) throw new BadRequestException("Adjustment would make the balance negative");
        balances.save(b);
        audit.record("LeaveBalance", employeeId + ":" + req.leaveTypeId() + ":" + req.year(), "ADJUSTED", before, b.getAdjusted() + " (" + req.reason() + ")");
        evict(employeeId, req.year());
        return balances(employeeId, req.year()).stream().filter(x -> x.leaveTypeId().equals(req.leaveTypeId())).findFirst().orElseThrow();
    }

    @Transactional(readOnly = true)
    public EncashableResponse encashable(String employeeId, String leaveTypeId, int year) {
        EntitlementDto rule = policies.defaultPolicy().entitlements().stream().filter(x -> x.leaveTypeId().equals(leaveTypeId)).findFirst().orElse(null);
        LeaveTypeResponse t = types.byId().get(leaveTypeId);
        Optional<LeaveBalance> b = balances.findById(new LeaveBalanceId(employeeId, leaveTypeId, year));
        BigDecimal available = b.map(LeaveBalance::available).orElse(BigDecimal.ZERO);
        BigDecimal max = rule != null && rule.encashable() ? rule.encashmentMaxDays() : BigDecimal.ZERO;
        return new EncashableResponse(leaveTypeId, t == null ? null : t.code(), year, available, max, available.min(max).max(BigDecimal.ZERO));
    }

    @Transactional
    public EncashableResponse encash(String employeeId, EncashRequest req) {
        EncashableResponse e = encashable(employeeId, req.leaveTypeId(), req.year());
        if (req.days().compareTo(e.encashableDays()) > 0) {
            throw new BadRequestException("Only " + e.encashableDays().toPlainString() + " day(s) can be encashed for this leave type");
        }
        LeaveBalance b = lock(employeeId, req.leaveTypeId(), req.year());
        b.setEncashed(b.getEncashed().add(req.days()));
        balances.save(b);
        audit.record("LeaveBalance", employeeId + ":" + req.leaveTypeId() + ":" + req.year(), "ENCASHED", req.days());
        evict(employeeId, req.year());
        return encashable(employeeId, req.leaveTypeId(), req.year());
    }

    public void evict(String employeeId, int year) {
        cache.evict("leaveBalance", employeeId + ":" + year);
    }
}
