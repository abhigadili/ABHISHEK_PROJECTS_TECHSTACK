package com.hrportal.attendance.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.hrportal.common.validation.ValidDateRange;
import com.hrportal.common.validation.DateRangeAware;
import com.hrportal.common.validation.ValidEmployeeId;

import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class AttendanceDtos {
    private AttendanceDtos() {
    }

    // ---- shifts
    public record ShiftRequest(@NotBlank @Size(max = 20) String code, @NotBlank @Size(max = 80) String name, @NotNull LocalTime startTime,
                               @NotNull LocalTime endTime, @Min(0) @Max(120) Integer graceMinutes, @Min(60) @Max(960) Integer standardMinutes,
                               @Min(60) @Max(960) Integer fullDayMinutes, @Min(30) @Max(960) Integer halfDayMinutes,
                               @Min(0) @Max(240) Integer overtimeThresholdMinutes,
                               @Pattern(regexp = "^(MON|TUE|WED|THU|FRI|SAT|SUN)(,(MON|TUE|WED|THU|FRI|SAT|SUN))*$", message = "weeklyOffs like SAT,SUN") String weeklyOffs,
                               Boolean defaultShift, Boolean active) { }

    public record ShiftResponse(String id, String code, String name, LocalTime startTime, LocalTime endTime, int graceMinutes, int standardMinutes,
                                int fullDayMinutes, int halfDayMinutes, int overtimeThresholdMinutes, String weeklyOffs, boolean defaultShift, boolean active) { }

    public record AssignmentRequest(@NotBlank @ValidEmployeeId String employeeId, @NotNull LocalDate effectiveFrom, LocalDate effectiveTo) { }

    public record AssignmentResponse(String id, String employeeId, String shiftId, LocalDate effectiveFrom, LocalDate effectiveTo) { }

    // ---- punches / records
    public record CheckInRequest(@Pattern(regexp = "OFFICE|WFH") String workMode) { }

    public record AttendanceResponse(String id, String employeeId, LocalDate workDate, Instant checkIn, Instant checkOut, String workMode,
                                     String status, int workedMinutes, int lateMinutes, int earlyDepartureMinutes, int overtimeMinutes,
                                     String shiftId, String source, String remarks) { }

    public record PunchDto(@NotBlank @ValidEmployeeId String employeeId, @NotNull Instant timestamp) { }

    public record PunchImportRequest(@NotEmpty @Size(max = 1000) List<@Valid PunchDto> punches) { }

    public record PunchImportResponse(int queued, int queueDepth) { }

    public record CalendarDay(LocalDate date, String type, String status, Instant checkIn, Instant checkOut, int workedMinutes, String note) { }

    public record DailyReportRow(String employeeId, String employeeName, String status, Instant checkIn, Instant checkOut, int workedMinutes, int lateMinutes, String workMode) { }

    // ---- corrections
    public record CorrectionRequest(@NotNull LocalDate workDate, @NotNull Instant checkIn, @NotNull Instant checkOut,
                                    @NotBlank @Size(min = 5, max = 500) String reason) {
        @JsonIgnore
        @AssertTrue(message = "checkOut must be after checkIn")
        public boolean isTimesValid() {
            return checkIn == null || checkOut == null || checkOut.isAfter(checkIn);
        }
    }

    public record DecisionRequest(@Size(max = 500) String comment) { }

    public record CorrectionResponse(String id, String employeeId, String employeeName, LocalDate workDate, Instant requestedCheckIn,
                                     Instant requestedCheckOut, String reason, String status, String managerId, String reviewerId,
                                     String reviewComment, Instant reviewedAt, boolean escalated, Instant createdAt) { }

    // ---- work from home
    @ValidDateRange
    public record WfhCreateRequest(@NotNull LocalDate fromDate, @NotNull LocalDate toDate, @NotBlank @Size(min = 3, max = 500) String reason) implements DateRangeAware {
        @JsonIgnore
        @Override
        public LocalDate rangeStart() {
            return fromDate;
        }

        @JsonIgnore
        @Override
        public LocalDate rangeEnd() {
            return toDate;
        }
    }

    public record WfhResponse(String id, String employeeId, String employeeName, LocalDate fromDate, LocalDate toDate, String reason, String status,
                              String managerId, String reviewerId, String reviewComment, Instant reviewedAt, Instant createdAt) { }

    // ---- summaries
    public record MonthlySummaryResponse(String employeeId, int year, int month, int totalDays, int workingDays, int presentDays, int halfDays, int absentDays,
                                         int leaveDays, int holidays, int weeklyOffs, int wfhDays, int missingPunches, int lateCount, int lateMinutes,
                                         int earlyCount, int workedMinutes, int overtimeMinutes, Instant generatedAt) { }
}
