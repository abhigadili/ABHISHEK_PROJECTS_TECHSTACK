package com.hrportal.leave.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.hrportal.common.validation.DateRangeAware;
import com.hrportal.common.validation.ValidDateRange;
import com.hrportal.leave.validation.NoLeaveOverlap;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public final class LeaveDtos {
    private LeaveDtos() {
    }

    // ---- master data
    public record LeaveTypeRequest(@NotBlank @Size(max = 20) String code, @NotBlank @Size(max = 80) String name, @Size(max = 300) String description,
                                   Boolean paid, Boolean balanceTracked, Boolean halfDayAllowed, @Min(1) Integer attachmentRequiredFromDays,
                                   Boolean requiresHrApproval, @Pattern(regexp = "MALE|FEMALE") String genderRestriction, Boolean active) { }

    public record LeaveTypeResponse(String id, String code, String name, String description, boolean paid, boolean balanceTracked,
                                    boolean halfDayAllowed, Integer attachmentRequiredFromDays, boolean requiresHrApproval,
                                    String genderRestriction, boolean active) { }

    public record EntitlementDto(@NotBlank String leaveTypeId, @NotNull @PositiveOrZero BigDecimal annualDays, @NotNull @PositiveOrZero BigDecimal accrualPerMonth,
                                 @NotNull @PositiveOrZero BigDecimal carryForwardMax, boolean encashable, @NotNull @PositiveOrZero BigDecimal encashmentMaxDays) { }

    public record PolicyRequest(@NotBlank @Size(max = 100) String name, @Size(max = 300) String description, Boolean defaultPolicy,
                                Boolean active, @Min(1) @Max(60) Integer hrApprovalThresholdDays, @Valid List<EntitlementDto> rules) { }

    public record PolicyResponse(String id, String name, String description, boolean defaultPolicy, boolean active,
                                 int hrApprovalThresholdDays, List<EntitlementDto> entitlements) { }

    // ---- applications
    @ValidDateRange
    @NoLeaveOverlap
    public record LeaveApplyRequest(@NotBlank String leaveTypeId, @NotNull LocalDate fromDate, @NotNull LocalDate toDate,
                                    boolean halfDayStart, boolean halfDayEnd, @NotBlank @Size(min = 3, max = 500) String reason,
                                    @Size(max = 5) List<@NotBlank String> attachmentDocumentIds) implements DateRangeAware {
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

    public record LeaveUpdateRequest(@NotNull LocalDate fromDate, @NotNull LocalDate toDate, boolean halfDayStart, boolean halfDayEnd,
                                     @NotBlank @Size(min = 3, max = 500) String reason) { }

    public record DecisionRequest(@Size(max = 500) String comment) { }

    public record CancelRequest(@NotBlank @Size(max = 300) String reason) { }

    public record CommentRequest(@NotBlank @Size(max = 1000) String comment) { }

    public record AttachmentDto(String id, String documentId, String fileName) { }

    public record LeaveApplicationResponse(String id, String employeeId, String employeeName, String leaveTypeId, String leaveTypeName,
                                           LocalDate fromDate, LocalDate toDate, boolean halfDayStart, boolean halfDayEnd, BigDecimal days,
                                           String reason, String status, String stage, String managerId, boolean cancelRequested,
                                           String cancelReason, Instant appliedAt, Instant decidedAt, List<AttachmentDto> attachments) { }

    public record ApprovalResponse(String id, String applicationId, String stage, String action, String actorId, String comment, Instant createdAt) { }

    public record CommentResponse(String id, String applicationId, String authorId, String comment, Instant createdAt) { }

    // ---- balances
    public record BalanceResponse(String leaveTypeId, String leaveTypeCode, String leaveTypeName, int year, BigDecimal opening, BigDecimal accrued,
                                  BigDecimal carriedForward, BigDecimal adjusted, BigDecimal used, BigDecimal pending, BigDecimal encashed, BigDecimal available) { }

    public record BalanceHistoryResponse(Long id, String leaveTypeId, int balanceYear, BigDecimal oldAccrued, BigDecimal newAccrued, BigDecimal oldUsed,
                                         BigDecimal newUsed, BigDecimal oldPending, BigDecimal newPending, BigDecimal oldCarried, BigDecimal newCarried,
                                         BigDecimal oldEncashed, BigDecimal newEncashed, Instant changedAt, String changedBy) { }

    public record ReconciledBalance(String leaveTypeId, String leaveTypeCode, BigDecimal entitled, BigDecimal usedRecorded, BigDecimal usedFromApplications,
                                    BigDecimal pendingRecorded, BigDecimal pendingFromApplications, BigDecimal available, boolean consistent) { }

    public record AdjustmentRequest(@NotBlank String leaveTypeId, int year, @NotNull BigDecimal days, @NotBlank @Size(max = 300) String reason) { }

    public record EncashRequest(@NotBlank String leaveTypeId, int year, @NotNull @Positive BigDecimal days) { }

    public record EncashableResponse(String leaveTypeId, String leaveTypeCode, int year, BigDecimal available, BigDecimal maxEncashable, BigDecimal encashableDays) { }

    public record CalendarEntry(String applicationId, String employeeId, String employeeName, String leaveTypeName, LocalDate fromDate,
                                LocalDate toDate, BigDecimal days, String status) { }

    public record UnpaidDaysResponse(String employeeId, String month, BigDecimal unpaidDays) { }

    public record RunResult(String runKey, int recordsProcessed, boolean alreadyExecuted) { }
}
