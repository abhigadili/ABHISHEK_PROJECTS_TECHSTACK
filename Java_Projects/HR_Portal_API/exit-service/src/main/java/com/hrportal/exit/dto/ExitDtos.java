package com.hrportal.exit.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import com.hrportal.common.validation.ValidEmployeeId;
import com.hrportal.exit.validation.ValidResignationDate;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class ExitDtos {
    private ExitDtos() {
    }

    public record ResignationRequest(@NotNull @ValidResignationDate LocalDate requestedLastWorkingDay, @NotBlank @Size(min = 5, max = 1000) String reason) { }

    public record ManagerDecision(@NotNull Boolean approve, @Size(max = 500) String comment) { }

    public record ConfirmRequest(@NotNull LocalDate confirmedLastWorkingDay, @Min(0) @Max(180) Integer waiverDays, @Size(max = 500) String comment) { }

    public record ResignationResponse(String id, String employeeId, String employeeName, String managerId, String departmentId, LocalDate joiningDate, LocalDate submittedOn,
                                      LocalDate requestedLastWorkingDay, LocalDate confirmedLastWorkingDay, int noticePeriodDays, int waiverDays, int noticeShortfallDays,
                                      String reason, String status, String managerComment, String hrComment, Instant completedAt, Instant createdAt) { }

    public record HistoryResponse(String id, String resignationId, String fromStatus, String toStatus, String comment, String createdBy, Instant createdAt) { }

    // ---- tasks
    public record TaskRequest(@NotBlank @Pattern(regexp = "CHECKLIST|CLEARANCE|KT|ASSET|ACCESS") String kind, @NotBlank @Size(max = 200) String title, LocalDate dueDate,
                              @Pattern(regexp = "MANAGER|IT|FINANCE|ADMIN|HR") String department, @Size(max = 200) String topic, @ValidEmployeeId String transfereeEmployeeId,
                              @Size(max = 60) String assetTag, @Size(max = 80) String systemName) { }

    public record CompleteTaskRequest(@Size(max = 500) String remarks, @Size(max = 40) String assetCondition) { }

    public record TaskResponse(String id, String resignationId, String kind, String title, LocalDate dueDate, String status, Instant completedAt, String completedBy, String remarks,
                               String department, String topic, String transfereeEmployeeId, String assetTag, String assetCondition, LocalDate returnedOn, String systemName,
                               LocalDate revokedOn) { }

    // ---- interview
    public record ScheduleRequest(@NotNull Instant scheduledAt) { }

    public record InterviewCompleteRequest(@NotNull Map<String, String> answers, @NotBlank @Size(max = 2000) String feedbackSummary, Boolean wouldRecommend) { }

    public record InterviewResponse(String id, String resignationId, String formId, Instant scheduledAt, String conductedBy, String status, Map<String, String> answers,
                                    String feedbackSummary, Boolean wouldRecommend, Instant completedAt) { }

    public record InterviewFormResponse(String id, String name, List<Map<String, String>> questions) { }

    // ---- settlement
    public record ProcessSettlementRequest(@NotBlank @Size(max = 80) String paymentReference) { }

    public record SettlementLineResponse(String code, String description, String type, BigDecimal amount) { }

    public record SettlementResponse(String id, String resignationId, String employeeId, BigDecimal grossPayable, BigDecimal recoveries, BigDecimal netPayable, String status,
                                     String calculatedBy, String processedBy, String paymentReference, Instant paidAt, int tenureMonths, int noticeShortfallDays,
                                     List<SettlementLineResponse> lines) { }

    // ---- policy
    public record PolicyRequest(@Min(0) @Max(365) Integer defaultNoticeDays, @Min(0) @Max(180) Integer maxWaiverDays, Boolean withdrawalAfterConfirmation, @Min(28) @Max(31) Integer salaryDaysPerMonth) { }

    public record PolicyResponse(String id, int defaultNoticeDays, int maxWaiverDays, boolean withdrawalAfterConfirmation, int salaryDaysPerMonth) { }

    public record StatusSummary(Map<String, Long> byStatus, long total) { }
}
