package com.hrportal.payroll.client;

import java.math.BigDecimal;
import java.time.LocalDate;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/** The three synchronous OpenFeign dependencies of the Payroll service (Employee, Attendance, Leave). */
public final class PayrollClients {
    private PayrollClients() {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record EmployeeInfo(String id, String employeeCode, String fullName, String departmentId, String status, LocalDate joiningDate, LocalDate exitDate) { }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record AttendanceMonth(int workingDays, int presentDays, int halfDays, int absentDays, int leaveDays, int overtimeMinutes, int missingPunches) { }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record UnpaidDays(String employeeId, String month, BigDecimal unpaidDays) { }

    @FeignClient(name = "employee-service", url = "${hr.services.employee.url}")
    public interface EmployeeClient {
        @GetMapping("/api/v1/employees/{id}/summary")
        EmployeeInfo summary(@PathVariable("id") String id);
    }

    @FeignClient(name = "attendance-service", url = "${hr.services.attendance.url}")
    public interface AttendanceClient {
        @GetMapping("/api/v1/attendance/monthly/{employeeId}")
        AttendanceMonth monthly(@PathVariable("employeeId") String employeeId, @RequestParam("month") String month);
    }

    @FeignClient(name = "leave-service", url = "${hr.services.leave.url}")
    public interface LeaveClient {
        @GetMapping("/api/v1/leaves/unpaid-days")
        UnpaidDays unpaidDays(@RequestParam("employeeId") String employeeId, @RequestParam("month") String month);
    }
}
