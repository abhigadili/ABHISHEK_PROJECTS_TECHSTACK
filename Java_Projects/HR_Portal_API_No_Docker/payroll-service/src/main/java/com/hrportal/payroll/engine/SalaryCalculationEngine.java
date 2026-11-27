package com.hrportal.payroll.engine;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

import com.hrportal.payroll.engine.Calculators.OvertimePay;
import com.hrportal.payroll.engine.PayrollModel.Context;
import com.hrportal.payroll.engine.PayrollModel.Input;
import com.hrportal.payroll.engine.PayrollModel.Line;
import com.hrportal.payroll.engine.PayrollModel.LoanRecovery;
import com.hrportal.payroll.engine.PayrollModel.Result;
import com.hrportal.payroll.engine.PayrollModel.StructureItem;
import com.hrportal.payroll.entity.Adjustment;
import com.hrportal.payroll.entity.Enums.CalcType;
import com.hrportal.payroll.entity.Enums.ComponentType;
import com.hrportal.payroll.entity.Loan;

/**
 * Configurable salary calculation engine - a pure function of its {@link Input}.
 * <ol>
 *   <li>Loss of pay: LOP = absent days + 0.5 x half days + unpaid leave days; ratio = paid days / working days.</li>
 *   <li>Earnings from the structure through the calculator (strategy) registered for each CalcType, BASIC first, BALANCE last.</li>
 *   <li>Variable earnings: overtime (fn_overtime_pay), bonus / arrears / reimbursement / allowance adjustments.</li>
 *   <li>Deductions: PF, professional tax (slabs by gross), TDS (from the Tax service), other deductions, loan EMIs.</li>
 * </ol>
 */
@Component
public class SalaryCalculationEngine {
    private final Map<CalcType, ComponentCalculator> calculators = new EnumMap<>(CalcType.class);
    private final OvertimePay overtimePay;

    public SalaryCalculationEngine(List<ComponentCalculator> all, OvertimePay overtimePay) {
        all.forEach(c -> calculators.put(c.supports(), c));
        this.overtimePay = overtimePay;
    }

    public Result calculate(Input in) {
        BigDecimal workingDays = BigDecimal.valueOf(in.attendance().workingDays());
        BigDecimal lop = BigDecimal.valueOf(in.attendance().absentDays()).add(BigDecimal.valueOf(in.attendance().halfDays()).multiply(new BigDecimal("0.5")))
                .add(in.unpaidLeaveDays() == null ? BigDecimal.ZERO : in.unpaidLeaveDays()).min(workingDays).max(BigDecimal.ZERO);
        BigDecimal paid = workingDays.subtract(lop);
        BigDecimal ratio = workingDays.signum() == 0 ? BigDecimal.ONE : paid.divide(workingDays, 6, RoundingMode.HALF_UP);
        BigDecimal monthlyCtc = in.salary().getAnnualCtc().divide(BigDecimal.valueOf(12), 4, RoundingMode.HALF_UP);
        Context ctx = new Context(in, monthlyCtc, ratio);

        // ---- earnings: BASIC first (others depend on it), BALANCE last (needs everybody else)
        List<StructureItem> earnings = in.structure().stream().filter(s -> s.type() == ComponentType.EARNING && s.calcType() != CalcType.VARIABLE).sorted(
                Comparator.comparing((StructureItem s) -> s.calcType() == CalcType.BALANCE ? 2 : "BASIC".equals(s.code()) ? 0 : 1).thenComparingInt(StructureItem::displayOrder)).toList();
        for (StructureItem item : earnings) {
            BigDecimal amount = calculators.get(item.calcType()).calculate(item, ctx);
            add(ctx, new Line(item.code(), item.name(), ComponentType.EARNING, amount, null));
        }
        // ---- variable earnings
        int otMinutes = in.attendance().overtimeMinutes();
        if (otMinutes > 0 && ctx.basicFull.signum() > 0 && workingDays.signum() > 0) {
            BigDecimal hourly = ctx.basicFull.divide(workingDays.multiply(in.settings().standardHoursPerDay()), 4, RoundingMode.HALF_UP);
            BigDecimal pay = overtimePay.pay(otMinutes, hourly, in.settings().overtimeMultiplier());
            if (pay.signum() > 0) add(ctx, new Line("OVERTIME", "Overtime", ComponentType.EARNING, pay, otMinutes + " min"));
        }
        for (Adjustment a : in.adjustments()) {
            if (isEarning(a)) add(ctx, new Line(a.getType().name(), label(a), ComponentType.EARNING, a.getAmount(), a.getDescription()));
        }
        // ---- deductions (gross is known now)
        List<StructureItem> deductions = in.structure().stream().filter(s -> s.type() == ComponentType.DEDUCTION && s.calcType() != CalcType.VARIABLE)
                .sorted(Comparator.comparingInt(StructureItem::displayOrder)).toList();
        for (StructureItem item : deductions) {
            BigDecimal amount = calculators.get(item.calcType()).calculate(item, ctx);
            String note = null;
            if (item.calcType() == CalcType.TAX_TDS) {
                // TDS never takes more than the pay still available after the statutory deductions; the remainder is recovered in later months
                BigDecimal available = ctx.gross.subtract(sum(ctx.lines, ComponentType.DEDUCTION)).max(BigDecimal.ZERO);
                if (amount.compareTo(available) > 0) {
                    note = "limited to available pay (calculated " + amount + ")";
                    amount = available;
                }
            }
            if (amount.signum() > 0) add(ctx, new Line(item.code(), item.name(), ComponentType.DEDUCTION, amount, note));
        }
        for (Adjustment a : in.adjustments()) {
            if (!isEarning(a)) add(ctx, new Line("OTHER_DEDUCTION", "Other deduction", ComponentType.DEDUCTION, a.getAmount(), a.getDescription()));
        }
        List<LoanRecovery> recoveries = new ArrayList<>();
        for (Loan loan : in.loans()) {
            BigDecimal emi = loan.getEmi().min(loan.getOutstanding());
            if (emi.signum() > 0) {
                recoveries.add(new LoanRecovery(loan.getId(), emi));
                add(ctx, new Line("LOAN_EMI", "Loan recovery", ComponentType.DEDUCTION, emi, loan.getDescription()));
            }
        }
        BigDecimal gross = sum(ctx.lines, ComponentType.EARNING);
        BigDecimal ded = sum(ctx.lines, ComponentType.DEDUCTION);
        if (ded.compareTo(gross) > 0) throw new IllegalStateException("Deductions (" + ded + ") exceed gross earnings (" + gross + ")");
        return new Result(workingDays, paid, lop, otMinutes, ctx.lines, recoveries, gross, ded, gross.subtract(ded));
    }

    private static void add(Context ctx, Line line) {
        ctx.lines.add(line);
        if (line.type() == ComponentType.EARNING) ctx.gross = ctx.gross.add(line.amount());
    }

    private static BigDecimal sum(List<Line> lines, ComponentType type) {
        return lines.stream().filter(l -> l.type() == type).map(Line::amount).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static boolean isEarning(Adjustment a) {
        return a.getType() != com.hrportal.payroll.entity.Enums.AdjustmentType.OTHER_DEDUCTION;
    }

    private static String label(Adjustment a) {
        String n = a.getType().name().toLowerCase().replace('_', ' ');
        return Character.toUpperCase(n.charAt(0)) + n.substring(1);
    }
}
