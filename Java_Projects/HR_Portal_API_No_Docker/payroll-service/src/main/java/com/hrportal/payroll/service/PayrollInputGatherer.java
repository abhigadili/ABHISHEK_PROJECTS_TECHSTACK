package com.hrportal.payroll.service;

import java.time.Duration;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;

import com.hrportal.payroll.client.PayrollClients.AttendanceClient;
import com.hrportal.payroll.client.PayrollClients.AttendanceMonth;
import com.hrportal.payroll.client.PayrollClients.EmployeeClient;
import com.hrportal.payroll.client.PayrollClients.EmployeeInfo;
import com.hrportal.payroll.client.PayrollClients.LeaveClient;
import com.hrportal.payroll.client.PayrollClients.UnpaidDays;
import com.hrportal.payroll.client.TaxGateway;
import com.hrportal.payroll.client.TaxGateway.MonthlyTds;
import com.hrportal.payroll.engine.PayrollModel.AttendanceFacts;
import com.hrportal.payroll.engine.PayrollModel.EmployeeFacts;
import com.hrportal.payroll.engine.PayrollModel.Input;
import com.hrportal.payroll.engine.PayrollModel.StructureItem;
import com.hrportal.payroll.engine.PayrollSettings;
import com.hrportal.payroll.entity.Adjustment;
import com.hrportal.payroll.entity.EmployeeSalary;
import com.hrportal.payroll.entity.Loan;

/**
 * Collects everything the engine needs for one employee from four services, concurrently: employee profile (Feign), attendance
 * summary (Feign), unpaid leave (Feign) and monthly TDS (WebClient). The three Feign calls run as CompletableFutures on the bounded
 * {@code hrExecutor} pool and are joined with allOf / thenCombine; the Mono from WebClient is bridged with toFuture().
 * Context propagation (JWT + correlation id) is handled by the executor's TaskDecorator.
 */
@Component
public class PayrollInputGatherer {
    private static final Duration TIMEOUT = Duration.ofSeconds(30);

    private final EmployeeClient employees;
    private final AttendanceClient attendance;
    private final LeaveClient leave;
    private final TaxGateway tax;
    private final Executor executor;

    public PayrollInputGatherer(EmployeeClient employees, AttendanceClient attendance, LeaveClient leave, TaxGateway tax, @Qualifier("hrExecutor") Executor executor) {
        this.employees = employees;
        this.attendance = attendance;
        this.leave = leave;
        this.tax = tax;
        this.executor = executor;
    }

    public record Gathered(EmployeeSalary salary, CompletableFuture<Input> future) { }

    public CompletableFuture<Input> gather(String month, EmployeeSalary salary, List<StructureItem> structure, List<Adjustment> adjustments, List<Loan> loans, PayrollSettings settings) {
        String employeeId = salary.getEmployeeId();
        CompletableFuture<EmployeeInfo> emp = CompletableFuture.supplyAsync(() -> employees.summary(employeeId), executor);
        CompletableFuture<AttendanceMonth> att = CompletableFuture.supplyAsync(() -> attendance.monthly(employeeId, month), executor);
        CompletableFuture<UnpaidDays> unpaid = CompletableFuture.supplyAsync(() -> leave.unpaidDays(employeeId, month), executor);
        CompletableFuture<MonthlyTds> tds = tax.monthlyTds(employeeId, month).toFuture();
        return CompletableFuture.allOf(emp, att, unpaid, tds).orTimeout(TIMEOUT.toSeconds(), java.util.concurrent.TimeUnit.SECONDS)
                .thenApply(v -> {
                    EmployeeInfo e = emp.join();
                    AttendanceMonth a = att.join();
                    return new Input(month, salary, structure, new EmployeeFacts(e.id(), e.employeeCode(), e.fullName(), e.departmentId(), e.status()),
                            new AttendanceFacts(a.workingDays(), a.absentDays(), a.halfDays(), a.overtimeMinutes()), unpaid.join().unpaidDays(),
                            adjustments, loans, tds.join().tds(), settings);
                });
    }
}
