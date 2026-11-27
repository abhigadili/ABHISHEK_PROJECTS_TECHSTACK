package com.hrportal.payroll.engine;

import java.math.BigDecimal;
import java.math.RoundingMode;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import com.hrportal.payroll.engine.PayrollModel.Context;
import com.hrportal.payroll.engine.PayrollModel.StructureItem;
import com.hrportal.payroll.engine.PayrollSettings.PtSlab;
import com.hrportal.payroll.entity.Enums.CalcType;

/** The calculation strategies. All amounts are rounded HALF_UP to 2 decimals. */
public final class Calculators {
    private Calculators() {
    }

    static BigDecimal money(BigDecimal v) {
        return v.setScale(2, RoundingMode.HALF_UP);
    }

    /** Fixed monthly amount from the structure, reduced by the loss-of-pay ratio. */
    @Component
    public static class Fixed implements ComponentCalculator {
        @Override
        public CalcType supports() {
            return CalcType.FIXED;
        }

        @Override
        public BigDecimal calculate(StructureItem i, Context c) {
            c.fullEarningsFixed = c.fullEarningsFixed.add(i.value());
            return money(i.value().multiply(c.ratio));
        }
    }

    /** value % of the monthly CTC (typically BASIC). Remembers the basic because other components depend on it. */
    @Component
    public static class PercentOfCtc implements ComponentCalculator {
        @Override
        public CalcType supports() {
            return CalcType.PERCENT_OF_CTC;
        }

        @Override
        public BigDecimal calculate(StructureItem i, Context c) {
            BigDecimal full = c.monthlyCtc.multiply(i.value()).divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP);
            BigDecimal actual = money(full.multiply(c.ratio));
            if ("BASIC".equals(i.code())) {
                c.basicFull = full;
                c.basicActual = actual;
            }
            c.fullEarningsFixed = c.fullEarningsFixed.add(money(full));
            return actual;
        }
    }

    /** value % of the full-month basic (HRA ...). */
    @Component
    public static class PercentOfBasic implements ComponentCalculator {
        @Override
        public CalcType supports() {
            return CalcType.PERCENT_OF_BASIC;
        }

        @Override
        public BigDecimal calculate(StructureItem i, Context c) {
            BigDecimal full = c.basicFull.multiply(i.value()).divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP);
            c.fullEarningsFixed = c.fullEarningsFixed.add(money(full));
            return money(full.multiply(c.ratio));
        }
    }

    /** Balancing figure: whatever is left of the monthly CTC after all other earnings (special allowance). Processed after the others. */
    @Component
    public static class Balance implements ComponentCalculator {
        @Override
        public CalcType supports() {
            return CalcType.BALANCE;
        }

        @Override
        public BigDecimal calculate(StructureItem i, Context c) {
            BigDecimal full = c.monthlyCtc.subtract(c.fullEarningsFixed).max(BigDecimal.ZERO);
            return money(full.multiply(c.ratio));
        }
    }

    /** Provident fund: employee percentage of min(basic paid, wage ceiling) when enabled in the configuration. */
    @Component
    public static class StatutoryPf implements ComponentCalculator {
        @Override
        public CalcType supports() {
            return CalcType.STATUTORY_PF;
        }

        @Override
        public BigDecimal calculate(StructureItem i, Context c) {
            PayrollSettings s = c.input.settings();
            if (!s.pfEnabled()) return BigDecimal.ZERO;
            BigDecimal base = c.basicActual.min(s.pfWageCeiling());
            return money(base.multiply(s.pfEmployeePercent()).divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP));
        }
    }

    /** Professional tax: first slab whose limit covers the month's gross (slabs come from the configuration). */
    @Component
    public static class SlabProfessionalTax implements ComponentCalculator {
        @Override
        public CalcType supports() {
            return CalcType.SLAB_PT;
        }

        @Override
        public BigDecimal calculate(StructureItem i, Context c) {
            for (PtSlab slab : c.input.settings().ptSlabs()) {
                if (slab.upTo() == null || c.gross.compareTo(slab.upTo()) <= 0) return money(slab.amount());
            }
            return BigDecimal.ZERO;
        }
    }

    /** Monthly TDS: taken from the Tax service (approved declaration + financial-year computation). */
    @Component
    public static class TaxDeductedAtSource implements ComponentCalculator {
        @Override
        public CalcType supports() {
            return CalcType.TAX_TDS;
        }

        @Override
        public BigDecimal calculate(StructureItem i, Context c) {
            return money(c.input.monthlyTds() == null ? BigDecimal.ZERO : c.input.monthlyTds());
        }
    }

    /** Variable components are filled from adjustments / overtime / loans by the engine itself. */
    @Component
    public static class Variable implements ComponentCalculator {
        @Override
        public CalcType supports() {
            return CalcType.VARIABLE;
        }

        @Override
        public BigDecimal calculate(StructureItem i, Context c) {
            return BigDecimal.ZERO;
        }
    }

    /** Overtime pay uses the MySQL function fn_overtime_pay(minutes, hourly rate, multiplier) - the formula lives in one place, in the database. */
    @Component
    public static class OvertimePay {
        private final JdbcTemplate jdbc;

        public OvertimePay(JdbcTemplate jdbc) {
            this.jdbc = jdbc;
        }

        public BigDecimal pay(int minutes, BigDecimal hourlyRate, BigDecimal multiplier) {
            if (minutes <= 0) return BigDecimal.ZERO;
            return jdbc.queryForObject("SELECT fn_overtime_pay(?, ?, ?)", BigDecimal.class, minutes, hourlyRate, multiplier);
        }
    }
}
