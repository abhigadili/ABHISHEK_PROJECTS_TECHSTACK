package com.hrportal.exit.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Types;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.SqlParameter;
import org.springframework.jdbc.core.simple.SimpleJdbcCall;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import com.hrportal.common.audit.AuditService;
import com.hrportal.common.exception.BadRequestException;
import com.hrportal.common.exception.ForbiddenOperationException;
import com.hrportal.common.exception.ResourceNotFoundException;
import com.hrportal.common.exception.ServiceUnavailableException;
import com.hrportal.common.security.CurrentUser;
import com.hrportal.common.security.Role;
import com.hrportal.exit.client.ExitClients.LoanFacts;
import com.hrportal.exit.client.ExitClients.SalaryFacts;
import com.hrportal.exit.client.ExitClients.SettlementGateway;
import com.hrportal.exit.dto.ExitDtos.SettlementLineResponse;
import com.hrportal.exit.dto.ExitDtos.SettlementResponse;
import com.hrportal.exit.entity.Enums.LineType;
import com.hrportal.exit.entity.Enums.ResignationStatus;
import com.hrportal.exit.entity.Enums.SettlementStatus;
import com.hrportal.exit.entity.ExitPolicy;
import com.hrportal.exit.entity.Resignation;
import com.hrportal.exit.entity.Settlement;
import com.hrportal.exit.entity.SettlementLine;
import com.hrportal.exit.producer.ExitEventProducer;
import com.hrportal.exit.repository.ExitRepositories.SettlementLineRepository;
import com.hrportal.exit.repository.ExitRepositories.SettlementRepository;

import reactor.core.publisher.Mono;

/**
 * Full and final settlement (workflow steps 7 and 8). The inputs come from three services IN PARALLEL with WebClient (Mono.zip): salary
 * (Payroll), loan balances (Payroll) and encashable leave (Leave). Lines are stored and the stored procedure sp_exit_settlement_summary
 * aggregates the totals; processing records the payment and publishes settlement.processed, completion publishes employee.exited.
 */
@Service
public class SettlementService {
    private final SettlementRepository settlements;
    private final SettlementLineRepository lines;
    private final ExitWorkflowService workflow;
    private final SettlementGateway gateway;
    private final ExitEventProducer producer;
    private final AuditService audit;
    private final TransactionTemplate tx;
    private final SimpleJdbcCall summaryCall;
    @jakarta.persistence.PersistenceContext
    private jakarta.persistence.EntityManager em;

    public SettlementService(SettlementRepository settlements, SettlementLineRepository lines, ExitWorkflowService workflow, SettlementGateway gateway, ExitEventProducer producer,
                             AuditService audit, TransactionTemplate tx, JdbcTemplate jdbc) {
        this.settlements = settlements;
        this.lines = lines;
        this.workflow = workflow;
        this.gateway = gateway;
        this.producer = producer;
        this.audit = audit;
        this.tx = tx;
        this.summaryCall = new SimpleJdbcCall(jdbc).withProcedureName("sp_exit_settlement_summary").withoutProcedureColumnMetaDataAccess()
                .declareParameters(new SqlParameter("p_resignation_id", Types.VARCHAR))
                .returningResultSet("rows", (rs, i) -> Map.<String, Object>of("tenure", rs.getInt("tenure_months"), "shortfall", rs.getInt("notice_shortfall_days")));
    }

    public SettlementResponse calculate(String resignationId) {
        requirePayroll();
        Resignation r = workflow.find(resignationId);
        if (r.getStatus() != ResignationStatus.INTERVIEW_DONE && r.getStatus() != ResignationStatus.SETTLEMENT_PENDING) {
            throw new BadRequestException("The settlement can be calculated after the exit interview (current: " + r.getStatus() + ")");
        }
        if (settlements.findByResignationId(resignationId).filter(s -> s.getStatus() == SettlementStatus.PAID).isPresent()) throw new BadRequestException("The settlement is already paid");
        ExitPolicy policy = workflow.policy();
        // parallel, non-blocking fan-out; the single block() joins the zipped result on this servlet thread
        Object[] facts;
        try {
            facts = Mono.zip(gateway.salary(r.getEmployeeId()), gateway.loans(r.getEmployeeId()), gateway.encashableDays(r.getEmployeeId(), r.getConfirmedLastWorkingDay().getYear()))
                    .map(t -> new Object[]{t.getT1(), t.getT2(), t.getT3()}).block(Duration.ofSeconds(20));
        } catch (ResourceNotFoundException e) {
            throw new BadRequestException("The employee has no salary on record - cannot compute the settlement");
        } catch (RuntimeException e) {
            if (e instanceof com.hrportal.common.exception.ApiException) throw e;
            throw new ServiceUnavailableException("Payroll / Leave service did not answer: " + e.getClass().getSimpleName());
        }
        SalaryFacts salary = (SalaryFacts) facts[0];
        @SuppressWarnings("unchecked") List<LoanFacts> loans = (List<LoanFacts>) facts[1];
        BigDecimal encashDays = (BigDecimal) facts[2];
        BigDecimal days = BigDecimal.valueOf(policy.getSalaryDaysPerMonth());
        BigDecimal perDay = salary.monthlyCtc().divide(days, 4, RoundingMode.HALF_UP);
        BigDecimal basicPerDay = salary.monthlyBasic().divide(days, 4, RoundingMode.HALF_UP);

        List<SettlementLine> built = new ArrayList<>();
        int workedDays = Math.min(r.getConfirmedLastWorkingDay().getDayOfMonth(), policy.getSalaryDaysPerMonth());
        built.add(line("PENDING_SALARY", "Salary for " + workedDays + " day(s) of the last month", LineType.EARNING, perDay.multiply(BigDecimal.valueOf(workedDays))));
        if (encashDays.signum() > 0) built.add(line("LEAVE_ENCASHMENT", "Encashment of " + encashDays.stripTrailingZeros().toPlainString() + " leave day(s)", LineType.EARNING, basicPerDay.multiply(encashDays)));
        long served = ChronoUnit.DAYS.between(r.getSubmittedOn(), r.getConfirmedLastWorkingDay());
        long shortfall = Math.max(0, r.getNoticePeriodDays() - served - r.getWaiverDays());
        if (shortfall > 0) built.add(line("NOTICE_RECOVERY", "Notice period shortfall of " + shortfall + " day(s)", LineType.DEDUCTION, perDay.multiply(BigDecimal.valueOf(shortfall))));
        BigDecimal outstanding = loans.stream().filter(l -> "ACTIVE".equals(l.status())).map(LoanFacts::outstanding).reduce(BigDecimal.ZERO, BigDecimal::add);
        if (outstanding.signum() > 0) built.add(line("LOAN_RECOVERY", "Outstanding loans / advances", LineType.DEDUCTION, outstanding));

        String user = CurrentUser.auditName();
        return tx.execute(s -> {
            Settlement st = settlements.findByResignationId(resignationId).orElseGet(Settlement::new);
            st.setResignationId(resignationId);
            st.setEmployeeId(r.getEmployeeId());
            st.setCalculatedBy(user);
            st.setStatus(SettlementStatus.CALCULATED);
            st = settlements.saveAndFlush(st);
            lines.deleteBySettlementId(st.getId());
            lines.flush();
            for (SettlementLine l : built) {
                l.setSettlementId(st.getId());
                lines.save(l);
            }
            lines.flush();
            @SuppressWarnings("unchecked") List<Map<String, Object>> rows = (List<Map<String, Object>>) summaryCall.execute(Map.of("p_resignation_id", resignationId)).get("rows");
            em.refresh(st);                      // the stored procedure changed the row behind the persistence context's back
            Settlement fresh = st;
            Resignation res = workflow.find(resignationId);
            if (res.getStatus() == ResignationStatus.INTERVIEW_DONE) workflow.move(res, ResignationStatus.SETTLEMENT_PENDING, "Settlement calculated");
            audit.record("Settlement", fresh.getId(), "CALCULATED", "net " + fresh.getNetPayable());
            return toResponse(fresh, rows.isEmpty() ? 0 : (Integer) rows.get(0).get("tenure"), rows.isEmpty() ? 0 : (Integer) rows.get(0).get("shortfall"));
        });
    }

    @Transactional
    public SettlementResponse process(String resignationId, String paymentReference) {
        requirePayroll();
        Resignation r = workflow.find(resignationId);
        Settlement s = settlements.findByResignationId(resignationId).orElseThrow(() -> new BadRequestException("Calculate the settlement first"));
        if (s.getStatus() == SettlementStatus.PAID) throw new BadRequestException("The settlement is already paid");
        s.setStatus(SettlementStatus.PAID);
        s.setProcessedBy(CurrentUser.auditName());
        s.setPaymentReference(paymentReference);
        s.setPaidAt(Instant.now());
        settlements.save(s);
        producer.settlementProcessed(r, s.getNetPayable(), paymentReference);
        producer.notify(r.getEmployeeId(), "EXIT_SETTLEMENT_READY", r, Map.of(), "settled");
        audit.record("Settlement", s.getId(), "PROCESSED", paymentReference);
        return toResponse(s, 0, 0);
    }

    /** Step 8: only a PAID settlement lets HR complete the exit; the employee.exited event then updates the employee, account, org chart, leave, attendance ... */
    @Transactional
    public Object complete(String resignationId) {
        if (!CurrentUser.hasAnyRole(Role.HR_ADMIN, Role.SUPER_ADMIN)) throw new ForbiddenOperationException("Only HR can complete the exit");
        Resignation r = workflow.find(resignationId);
        if (r.getStatus() != ResignationStatus.SETTLEMENT_PENDING) throw new BadRequestException("The exit can be completed after the settlement (current: " + r.getStatus() + ")");
        Settlement s = settlements.findByResignationId(resignationId).orElseThrow(() -> new BadRequestException("No settlement exists"));
        if (s.getStatus() != SettlementStatus.PAID) throw new BadRequestException("The settlement has not been paid yet");
        var out = workflow.move(r, ResignationStatus.COMPLETED, "Exit completed");
        producer.exited(r);
        producer.notify(r.getManagerId(), "EXIT_COMPLETED", r, Map.of(), "done");
        return out;
    }

    @Transactional(readOnly = true)
    public SettlementResponse get(String resignationId) {
        Resignation r = workflow.find(resignationId);
        boolean owner = r.getEmployeeId().equals(CurrentUser.employeeId());
        if (!owner && !CurrentUser.hasAnyRole(Role.HR_ADMIN, Role.SUPER_ADMIN, Role.PAYROLL_ADMIN, Role.FINANCE_ADMIN)) throw new ForbiddenOperationException("You cannot view this settlement");
        Settlement s = settlements.findByResignationId(resignationId).orElseThrow(() -> ResourceNotFoundException.of("Settlement of", resignationId));
        return toResponse(s, (int) ChronoUnit.MONTHS.between(r.getJoiningDate() == null ? LocalDate.now() : r.getJoiningDate(), r.getConfirmedLastWorkingDay() == null ? LocalDate.now() : r.getConfirmedLastWorkingDay()),
                (int) Math.max(0, r.getNoticePeriodDays() - ChronoUnit.DAYS.between(r.getSubmittedOn(), r.getConfirmedLastWorkingDay() == null ? r.getRequestedLastWorkingDay() : r.getConfirmedLastWorkingDay()) - r.getWaiverDays()));
    }

    private static void requirePayroll() {
        if (!CurrentUser.hasAnyRole(Role.PAYROLL_ADMIN, Role.SUPER_ADMIN)) throw new ForbiddenOperationException("Settlements are calculated and processed by payroll");
    }

    private static SettlementLine line(String code, String description, LineType type, BigDecimal amount) {
        SettlementLine l = new SettlementLine();
        l.setCode(code);
        l.setDescription(description);
        l.setType(type);
        l.setAmount(amount.setScale(2, RoundingMode.HALF_UP));
        return l;
    }

    private SettlementResponse toResponse(Settlement s, int tenure, int shortfall) {
        List<SettlementLineResponse> ls = lines.findBySettlementIdOrderByTypeAscCodeAsc(s.getId()).stream().map(l -> new SettlementLineResponse(l.getCode(), l.getDescription(), l.getType().name(), l.getAmount())).toList();
        return new SettlementResponse(s.getId(), s.getResignationId(), s.getEmployeeId(), s.getGrossPayable(), s.getRecoveries(), s.getNetPayable(), s.getStatus().name(), s.getCalculatedBy(),
                s.getProcessedBy(), s.getPaymentReference(), s.getPaidAt(), tenure, shortfall, ls);
    }
}
