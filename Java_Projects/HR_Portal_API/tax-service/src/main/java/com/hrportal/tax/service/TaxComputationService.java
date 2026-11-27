package com.hrportal.tax.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hrportal.common.exception.BadRequestException;
import com.hrportal.common.exception.ForbiddenOperationException;
import com.hrportal.common.security.CurrentUser;
import com.hrportal.common.security.Role;
import com.hrportal.tax.client.PayrollGateway;
import com.hrportal.tax.client.PayrollGateway.SalarySummary;
import com.hrportal.tax.dto.TaxDtos.ComputationResponse;
import com.hrportal.tax.dto.TaxDtos.IncomeTaxStatement;
import com.hrportal.tax.dto.TaxDtos.MonthRow;
import com.hrportal.tax.dto.TaxDtos.MonthlyTdsResponse;
import com.hrportal.tax.engine.TaxEngine;
import com.hrportal.tax.engine.TaxEngine.Computation;
import com.hrportal.tax.entity.Enums.Regime;
import com.hrportal.tax.entity.MonthlyTds;
import com.hrportal.tax.entity.TaxComputation;
import com.hrportal.tax.entity.TaxDeclaration;
import com.hrportal.tax.entity.TaxRule;
import com.hrportal.tax.repository.TaxRepositories.ComputationRepository;
import com.hrportal.tax.repository.TaxRepositories.MonthlyTdsRepository;
import com.hrportal.tax.repository.TaxRepositories.RuleRepository;

/**
 * Annual tax computation (financial-year based) and the monthly TDS handed to payroll:
 * monthly TDS = (annual tax - TDS already told for earlier months of the year) / months remaining in the year, never below zero.
 * Only an APPROVED declaration reduces the taxable income; otherwise no deductions are assumed.
 */
@Service
@Transactional
public class TaxComputationService {
    private final PayrollGateway payroll;
    private final RuleRepository rules;
    private final ComputationRepository computations;
    private final MonthlyTdsRepository monthly;
    private final DeclarationService declarations;
    private final TaxEngine engine;

    public TaxComputationService(PayrollGateway payroll, RuleRepository rules, ComputationRepository computations, MonthlyTdsRepository monthly,
                                 DeclarationService declarations, TaxEngine engine) {
        this.payroll = payroll;
        this.rules = rules;
        this.computations = computations;
        this.monthly = monthly;
        this.declarations = declarations;
        this.engine = engine;
    }

    public ComputationResponse compute(String employeeId, String financialYear) {
        requireAccess(employeeId, false);
        return toResponse(doCompute(employeeId, financialYear));
    }

    /** Called by payroll for every employee of a run (payroll admin token). */
    public MonthlyTdsResponse monthlyTds(String employeeId, String month) {
        requireAccess(employeeId, true);
        YearMonth ym = YearMonth.parse(month);
        String fy = financialYearOf(ym);
        TaxComputation c;
        try {
            c = doCompute(employeeId, fy);
        } catch (SalaryMissing e) {
            return new MonthlyTdsResponse(employeeId, month, BigDecimal.ZERO, Regime.NEW.name(), false);
        }
        YearMonth fyEnd = YearMonth.of(fyStartYear(fy) + 1, 3);
        long remaining = Math.max(1, java.time.temporal.ChronoUnit.MONTHS.between(ym, fyEnd) + 1);
        BigDecimal alreadyTold = monthly.findByEmployeeIdAndFinancialYearOrderByTdsMonth(employeeId, fy).stream().filter(m -> m.getTdsMonth().compareTo(month) < 0)
                .map(MonthlyTds::getTds).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal tds = c.getTotalTax().subtract(alreadyTold).max(BigDecimal.ZERO).divide(BigDecimal.valueOf(remaining), 2, RoundingMode.HALF_UP);
        MonthlyTds row = monthly.findByEmployeeIdAndTdsMonth(employeeId, month).orElseGet(MonthlyTds::new);
        row.setEmployeeId(employeeId);
        row.setTdsMonth(month);
        row.setFinancialYear(fy);
        row.setTds(tds);
        row.setRegime(c.getRegime().name());
        row.setDeclarationApproved(c.isDeclarationApproved());
        row.setComputedAt(Instant.now());
        monthly.save(row);
        return new MonthlyTdsResponse(employeeId, month, tds, c.getRegime().name(), c.isDeclarationApproved());
    }

    /** Annual tax summary + income-tax statement (month-wise TDS table). */
    public IncomeTaxStatement statement(String employeeId, String financialYear) {
        requireAccess(employeeId, false);
        TaxComputation c = doCompute(employeeId, financialYear);
        List<MonthRow> months = monthly.findByEmployeeIdAndFinancialYearOrderByTdsMonth(employeeId, financialYear).stream().map(m -> new MonthRow(m.getTdsMonth(), m.getTds())).toList();
        BigDecimal deducted = months.stream().map(MonthRow::tds).reduce(BigDecimal.ZERO, BigDecimal::add);
        return new IncomeTaxStatement(employeeId, financialYear, toResponse(c), months, deducted, c.getTotalTax().subtract(deducted));
    }

    private TaxComputation doCompute(String employeeId, String fy) {
        SalarySummary salary = payroll.salary(employeeId).orElseThrow(() -> new SalaryMissing(employeeId));
        Regime regime = declarations.approvedOrLatest(employeeId, fy).map(TaxDeclaration::getRegime).orElse(Regime.NEW);
        TaxRule rule = rules.findByFinancialYearAndRegimeAndActiveTrue(fy, regime).orElseThrow(() -> new BadRequestException("No active tax rule configured for " + fy + " / " + regime));
        Map<String, BigDecimal> deductions = declarations.effectiveDeductions(employeeId, fy);
        Computation r = engine.compute(salary.annualCtc(), rule, deductions);
        TaxComputation c = computations.findByEmployeeIdAndFinancialYear(employeeId, fy).orElseGet(TaxComputation::new);
        c.setEmployeeId(employeeId);
        c.setFinancialYear(fy);
        c.setRegime(regime);
        c.setGrossIncome(r.gross());
        c.setStandardDeduction(r.standardDeduction());
        c.setTotalDeductions(r.deductions());
        c.setTaxableIncome(r.taxable());
        c.setSlabTax(r.slabTax());
        c.setRebate(r.rebate());
        c.setCess(r.cess());
        c.setTotalTax(r.totalTax());
        c.setDeclarationApproved(!deductions.isEmpty());
        c.setComputedAt(Instant.now());
        return computations.save(c);
    }

    public static String financialYearOf(YearMonth ym) {
        int start = ym.getMonthValue() >= 4 ? ym.getYear() : ym.getYear() - 1;
        return start + "-" + String.format("%02d", (start + 1) % 100);
    }

    private static int fyStartYear(String fy) {
        return Integer.parseInt(fy.substring(0, 4));
    }

    private void requireAccess(String employeeId, boolean allowPayroll) {
        if (employeeId.equals(CurrentUser.employeeId()) || CurrentUser.hasAnyRole(Role.FINANCE_ADMIN, Role.SUPER_ADMIN)) return;
        if (allowPayroll && CurrentUser.hasRole(Role.PAYROLL_ADMIN)) return;
        throw new ForbiddenOperationException("Tax information is restricted to the employee and finance");
    }

    private ComputationResponse toResponse(TaxComputation c) {
        return new ComputationResponse(c.getEmployeeId(), c.getFinancialYear(), c.getRegime().name(), c.getGrossIncome(), c.getStandardDeduction(), c.getTotalDeductions(),
                c.getTaxableIncome(), c.getSlabTax(), c.getRebate(), c.getCess(), c.getTotalTax(), c.isDeclarationApproved(), c.getComputedAt());
    }

    /** Payroll cannot compute TDS before a salary exists: the monthly endpoint answers 0 instead of failing. */
    private static final class SalaryMissing extends BadRequestException {
        SalaryMissing(String employeeId) {
            super("No salary is assigned to employee " + employeeId);
        }
    }
}
