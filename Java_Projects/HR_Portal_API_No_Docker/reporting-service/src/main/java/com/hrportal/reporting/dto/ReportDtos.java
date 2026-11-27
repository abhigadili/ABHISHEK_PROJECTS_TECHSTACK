package com.hrportal.reporting.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public final class ReportDtos {
    private ReportDtos() {
    }

    public record CountRow(String key, String label, long count) { }

    public record HeadcountReport(String groupBy, long total, long active, List<CountRow> rows, Map<String, Long> byStatus) { }

    public record MonthRow(String month, long count) { }

    public record JoiningExitSummary(int year, List<MonthRow> joiners, List<MonthRow> leavers, long totalJoiners, long totalLeavers, long netChange) { }

    public record LeaveReportRow(String leaveType, String status, long applications, BigDecimal days) { }

    public record LeaveReport(String period, List<LeaveReportRow> rows, BigDecimal approvedDays) { }

    public record AttendanceReportRow(String departmentId, String departmentName, long employeeDays, BigDecimal averageWorkedMinutes, long lateCount, BigDecimal overtimeMinutes) { }

    public record AttendanceReport(String period, List<AttendanceReportRow> rows) { }

    public record PayrollDepartmentRow(String departmentId, String departmentName, long employees, BigDecimal gross, BigDecimal deductions, BigDecimal net) { }

    public record PayrollReport(String month, long employees, BigDecimal totalGross, BigDecimal totalDeductions, BigDecimal totalNet, BigDecimal averageNet, List<PayrollDepartmentRow> departments) { }

    public record TaxReport(String financialYear, Map<String, Long> declarationsByStatus, BigDecimal totalDeclared, Map<String, Long> byRegime) { }

    public record ProjectAllocationRow(String projectId, String projectName, long employees, BigDecimal averagePercent, BigDecimal totalPercent) { }

    public record TimesheetReportRow(String employeeId, String employeeName, BigDecimal totalHours, BigDecimal billableHours, BigDecimal billablePercent) { }

    public record TimesheetReport(String period, BigDecimal totalHours, BigDecimal billableHours, List<TimesheetReportRow> rows) { }

    public record PerformanceReport(String cycleId, long reviews, long approved, BigDecimal averageSelf, BigDecimal averageManager, BigDecimal averageFinal, Map<String, Long> finalRatingDistribution) { }

    public record ExitReport(long open, long completed, BigDecimal averageNoticeDays, List<MonthRow> byMonth, Map<String, Long> byStatus) { }

    public record ExecutiveSummary(Map<String, Object> sections, long elapsedMs) { }
}
