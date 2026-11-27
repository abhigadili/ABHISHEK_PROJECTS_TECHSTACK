package com.hrportal.performance.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.hrportal.common.validation.DateRangeAware;
import com.hrportal.common.validation.ValidDateRange;
import com.hrportal.common.validation.ValidEmployeeId;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public final class PerformanceDtos {
    private PerformanceDtos() {
    }

    private static final String RATING_MIN = "1.0";
    private static final String RATING_MAX = "5.0";

    // ---- forms
    public record QuestionDto(String id, @NotBlank @Size(max = 80) String section, @NotBlank @Size(max = 500) String text,
                              @NotBlank @Pattern(regexp = "RATING|TEXT") String type, @DecimalMin("0.1") @DecimalMax("10") BigDecimal weight, Boolean required, @Min(1) Integer orderNo) { }

    public record FormRequest(@NotBlank @Size(max = 120) String name, @Size(max = 300) String description, Boolean active, @NotEmpty List<@Valid QuestionDto> questions) { }

    public record FormResponse(String id, String name, String description, boolean active, List<QuestionDto> questions) { }

    // ---- cycles
    @ValidDateRange
    public record CycleRequest(@NotBlank @Size(max = 120) String name, @Pattern(regexp = "ANNUAL|HALF_YEARLY|QUARTERLY|PROBATION") String type, @NotNull LocalDate periodStart,
                               @NotNull LocalDate periodEnd, @NotNull LocalDate selfEvalDeadline, @NotNull LocalDate managerEvalDeadline, @NotBlank String formId) implements DateRangeAware {
        @JsonIgnore
        @Override
        public LocalDate rangeStart() {
            return periodStart;
        }

        @JsonIgnore
        @Override
        public LocalDate rangeEnd() {
            return periodEnd;
        }
    }

    public record CycleResponse(String id, String name, String type, LocalDate periodStart, LocalDate periodEnd, LocalDate selfEvalDeadline, LocalDate managerEvalDeadline,
                                String formId, String status) { }

    // ---- reviews
    public record AnswerDto(@NotBlank String questionId, @DecimalMin(RATING_MIN) @DecimalMax(RATING_MAX) BigDecimal rating, @Size(max = 2000) String answerText) { }

    public record SelfEvaluationRequest(@DecimalMin(RATING_MIN) @DecimalMax(RATING_MAX) BigDecimal selfRating, @Size(max = 2000) String achievements, @Size(max = 2000) String strengths,
                                        @Size(max = 2000) String improvementAreas, @Valid List<AnswerDto> answers) { }

    public record ManagerEvaluationRequest(@DecimalMin(RATING_MIN) @DecimalMax(RATING_MAX) BigDecimal managerRating, @Size(max = 2000) String managerFeedback,
                                           @Size(max = 2000) String strengths, @Size(max = 2000) String improvementAreas, @Valid List<AnswerDto> answers) { }

    public record ApprovalRequest(@NotNull @DecimalMin(RATING_MIN) @DecimalMax(RATING_MAX) BigDecimal finalRating, @Size(max = 1000) String comment) { }

    public record ReturnRequest(@NotBlank @Size(max = 1000) String comment) { }

    public record AnswerResponse(String questionId, String respondent, BigDecimal rating, String answerText) { }

    public record ReviewResponse(String id, String cycleId, String employeeId, String employeeName, String managerId, String formId, String status, BigDecimal selfRating,
                                 BigDecimal managerRating, BigDecimal finalRating, BigDecimal computedSelfScore, BigDecimal computedManagerScore, String achievements,
                                 String strengths, String improvementAreas, String managerFeedback, String hrComment, Instant selfSubmittedAt, Instant managerSubmittedAt,
                                 Instant approvedAt, List<AnswerResponse> answers) { }

    public record HistoryResponse(String id, String reviewId, String action, String status, String comment, String createdBy, Instant createdAt) { }

    // ---- goals
    public record KeyResultDto(String id, @NotBlank @Size(max = 300) String description, @NotNull @Positive BigDecimal targetValue, BigDecimal currentValue, @Size(max = 30) String unit) { }

    public record GoalRequest(String cycleId, @NotBlank @Size(max = 200) String title, @Size(max = 1000) String description, @Pattern(regexp = "GOAL|OKR") String type,
                              LocalDate targetDate, @Min(1) @Max(10) Integer weight, @Valid List<KeyResultDto> keyResults) { }

    public record ProgressRequest(@NotNull @Min(0) @Max(100) Integer progress, @Pattern(regexp = "NOT_STARTED|IN_PROGRESS|COMPLETED|CANCELLED") String status) { }

    public record KeyResultProgress(@NotNull BigDecimal currentValue) { }

    public record GoalResponse(String id, String employeeId, String cycleId, String title, String description, String type, LocalDate targetDate, int progress, int weight,
                               String status, List<KeyResultDto> keyResults) { }

    // ---- feedback
    public record FeedbackRequest(@NotBlank @ValidEmployeeId String toEmployeeId, @NotBlank @Pattern(regexp = "MANAGER|PEER") String type, @NotBlank @Size(min = 5, max = 2000) String comment,
                                  @DecimalMin(RATING_MIN) @DecimalMax(RATING_MAX) BigDecimal rating, String reviewId) { }

    public record FeedbackResponse(String id, String toEmployeeId, String fromEmployeeId, String type, String comment, BigDecimal rating, Instant createdAt) { }

    // ---- reports
    public record CycleSummary(String cycleId, String cycleName, long totalReviews, Map<String, Long> byStatus, BigDecimal averageSelfRating, BigDecimal averageManagerRating,
                               BigDecimal averageFinalRating, Map<String, Long> finalRatingDistribution) { }

    public record EmployeeReviewHistory(String employeeId, List<ReviewResponse> reviews) { }
}
