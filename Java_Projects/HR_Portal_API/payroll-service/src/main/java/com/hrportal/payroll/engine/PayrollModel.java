package com.hrportal.payroll.engine;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

import com.hrportal.payroll.entity.Adjustment;
import com.hrportal.payroll.entity.EmployeeSalary;
import com.hrportal.payroll.entity.Enums.CalcType;
import com.hrportal.payroll.entity.Enums.ComponentType;
import com.hrportal.payroll.entity.Loan;

/** Immutable inputs and outputs of the calculation engine. */
public final class PayrollModel {
    private PayrollModel() {
    }

    /** One component of the employee's structure with its configured value. */
    public record StructureItem(String code, String name, ComponentType type, CalcType calcType, BigDecimal value, int displayOrder) { }

    public record EmployeeFacts(String employeeId, String employeeCode, String fullName, String departmentId, String status) { }

    /** Attendance of the month as delivered by the Attendance service. */
    public record AttendanceFacts(int workingDays, int absentDays, int halfDays, int overtimeMinutes) { }

    public record Input(String month, EmployeeSalary salary, List<StructureItem> structure, EmployeeFacts employee, AttendanceFacts attendance,
                        BigDecimal unpaidLeaveDays, List<Adjustment> adjustments, List<Loan> loans, BigDecimal monthlyTds, PayrollSettings settings) { }

    public record Line(String code, String name, ComponentType type, BigDecimal amount, String note) { }

    public record LoanRecovery(String loanId, BigDecimal amount) { }

    public record Result(BigDecimal workingDays, BigDecimal paidDays, BigDecimal lopDays, int overtimeMinutes, List<Line> lines, List<LoanRecovery> loanRecoveries,
                         BigDecimal gross, BigDecimal deductions, BigDecimal net) { }

    /** Mutable working state shared by the calculators while one employee is being computed. */
    public static final class Context {
        public final Input input;
        public final BigDecimal monthlyCtc;
        public final BigDecimal ratio;            // paid days / working days
        public BigDecimal basicFull = BigDecimal.ZERO;     // full-month basic (before LOP proration)
        public BigDecimal basicActual = BigDecimal.ZERO;   // basic actually paid
        public BigDecimal fullEarningsFixed = BigDecimal.ZERO;   // sum of full-month non-balance earnings
        public BigDecimal gross = BigDecimal.ZERO;
        public final List<Line> lines = new ArrayList<>();

        public Context(Input input, BigDecimal monthlyCtc, BigDecimal ratio) {
            this.input = input;
            this.monthlyCtc = monthlyCtc;
            this.ratio = ratio;
        }
    }
}
