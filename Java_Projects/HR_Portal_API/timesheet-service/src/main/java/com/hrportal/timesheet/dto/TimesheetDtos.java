package com.hrportal.timesheet.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import com.hrportal.timesheet.validation.ValidTimesheetWeek;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public final class TimesheetDtos {
    private TimesheetDtos() {
    }

    public record EntryRequest(@NotBlank String projectId, String taskId, @NotNull LocalDate workDate,
                               @NotNull @DecimalMin(value = "0.25", message = "hours must be at least 0.25") @DecimalMax(value = "16.00", message = "at most 16 hours per entry") BigDecimal hours,
                               Boolean billable, @Size(max = 300) String description) { }

    public record SaveEntriesRequest(@NotNull @ValidTimesheetWeek LocalDate weekStart, @NotEmpty @Size(max = 100) List<@Valid EntryRequest> entries) { }

    public record DecisionRequest(@Size(max = 500) String comment) { }

    public record ReopenRequest(@NotBlank @Size(max = 500) String reason) { }

    public record EntryResponse(String id, String projectId, String taskId, LocalDate workDate, BigDecimal hours, boolean billable, String description) { }

    public record TimesheetResponse(String id, String employeeId, String employeeName, LocalDate weekStart, String status, BigDecimal totalHours,
                                    BigDecimal billableHours, Instant submittedAt, String approverId, String decisionComment, Instant decidedAt,
                                    int resubmissionCount, List<EntryResponse> entries) { }

    public record HistoryResponse(String id, String timesheetId, String action, String actorId, String comment, Instant createdAt) { }

    public record TaskRequest(@NotBlank String projectId, @NotBlank @Size(max = 30) String code, @NotBlank @Size(max = 150) String name, Boolean billable, Boolean active) { }

    public record TaskResponse(String id, String projectId, String code, String name, boolean billable, boolean active) { }

    // ---- reports
    public record ProjectHours(String projectId, BigDecimal totalHours, BigDecimal billableHours, BigDecimal nonBillableHours) { }

    public record EmployeeHoursSummary(String employeeId, LocalDate from, LocalDate to, BigDecimal totalHours, BigDecimal billableHours, BigDecimal nonBillableHours,
                                       BigDecimal billablePercent, List<ProjectHours> byProject) { }

    public record EmployeeHours(String employeeId, BigDecimal totalHours, BigDecimal billableHours) { }

    public record ProjectHoursSummary(String projectId, LocalDate from, LocalDate to, BigDecimal totalHours, BigDecimal billableHours, List<EmployeeHours> byEmployee) { }

    public record WeeklyTotals(Map<LocalDate, BigDecimal> hoursByDay, BigDecimal weekTotal) { }
}
