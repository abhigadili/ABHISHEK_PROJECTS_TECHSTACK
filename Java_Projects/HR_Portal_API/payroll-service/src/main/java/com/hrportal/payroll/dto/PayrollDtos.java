package com.hrportal.payroll.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import com.hrportal.common.validation.ValidEmployeeId;
import com.hrportal.payroll.validation.ComponentDefinition;
import com.hrportal.payroll.validation.ValidSalaryComponent;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public final class PayrollDtos {
    private PayrollDtos() {
    }

    private static final String MONTH = "^\\d{4}-(0[1-9]|1[0-2])$";

    // ---- components / structures
    @ValidSalaryComponent
    public record ComponentRequest(@NotBlank @Pattern(regexp = "^[A-Z][A-Z0-9_]{1,39}$", message = "code must be UPPER_SNAKE_CASE") String code,
                                   @NotBlank @Size(max = 100) String name, @NotBlank @Pattern(regexp = "EARNING|DEDUCTION") String type,
                                   @NotBlank @Pattern(regexp = "FIXED|PERCENT_OF_CTC|PERCENT_OF_BASIC|BALANCE|STATUTORY_PF|SLAB_PT|TAX_TDS|VARIABLE") String calcType,
                                   Boolean taxable, @Min(1) Integer displayOrder, Boolean active) implements ComponentDefinition { }

    public record ComponentResponse(String id, String code, String name, String type, String calcType, boolean taxable, int displayOrder, boolean active) { }

    public record StructureLine(@NotBlank String componentId, @NotNull @PositiveOrZero BigDecimal value) { }

    public record StructureRequest(@NotBlank @Size(max = 100) String name, @Size(max = 300) String description, Boolean active,
                                   @NotEmpty List<@Valid StructureLine> components) { }

    public record StructureLineResponse(String componentId, String componentCode, String componentName, String type, String calcType, BigDecimal value) { }

    public record StructureResponse(String id, String name, String description, boolean active, List<StructureLineResponse> components) { }

    // ---- salary
    public record AssignSalaryRequest(@NotBlank String structureId, @NotNull @Positive BigDecimal annualCtc, @NotNull LocalDate effectiveFrom,
                                      @Size(min = 3, max = 3) String currency) { }

    public record SalaryResponse(String id, String employeeId, String structureId, String structureName, BigDecimal annualCtc, BigDecimal monthlyCtc,
                                 String currency, LocalDate effectiveFrom, LocalDate effectiveTo, String status) { }

    public record SalaryHistoryResponse(Long id, String employeeId, String salaryId, String action, BigDecimal oldCtc, BigDecimal newCtc, String oldStatus,
                                        String newStatus, LocalDate effectiveFrom, Instant changedAt, String changedBy) { }

    public record RevisionRequest(@NotNull @Positive BigDecimal newCtc, String newStructureId, @NotNull LocalDate effectiveFrom,
                                  @NotBlank @Size(min = 3, max = 300) String reason) { }

    public record RevisionResponse(String id, String employeeId, BigDecimal oldCtc, BigDecimal newCtc, String newStructureId, LocalDate effectiveFrom, String reason,
                                   String status, String decidedBy, Instant decidedAt, String decisionComment, Instant createdAt) { }

    public record DecisionRequest(@Size(max = 300) String comment) { }

    public record SalarySummary(String employeeId, String structureName, BigDecimal annualCtc, BigDecimal monthlyCtc, BigDecimal monthlyBasic, String latestMonth,
                                BigDecimal latestGross, BigDecimal latestNet, BigDecimal ytdGross, BigDecimal ytdDeductions, BigDecimal ytdNet, int ytdMonths) { }

    // ---- configuration
    public record ConfigResponse(String key, String value, String description, Instant effectiveFrom) { }

    public record ConfigUpdate(@NotBlank @Size(max = 2000) String value, @Size(max = 300) String description) { }

    // ---- runs
    public record RunRequest(@NotBlank @Pattern(regexp = MONTH, message = "month must be yyyy-MM") String month, @Size(max = 300) String note) { }

    public record RunResponse(String id, String payrollMonth, String status, int employeeCount, BigDecimal totalGross, BigDecimal totalDeductions, BigDecimal totalNet,
                              Instant processedAt, String processedBy, Instant approvedAt, String approvedBy, Instant finalizedAt, String finalizedBy, String note) { }

    public record LineResponse(String componentCode, String componentName, String type, BigDecimal amount, String note) { }

    public record EntryResponse(String id, String runId, String payrollMonth, String employeeId, String employeeName, String employeeCode, String departmentId,
                                BigDecimal workingDays, BigDecimal paidDays, BigDecimal lopDays, int overtimeMinutes, BigDecimal gross, BigDecimal deductions,
                                BigDecimal net, List<LineResponse> lines) { }

    // ---- adjustments / loans
    public record AdjustmentRequest(@NotBlank @ValidEmployeeId String employeeId, @NotBlank @Pattern(regexp = MONTH, message = "month must be yyyy-MM") String month,
                                    @NotBlank @Pattern(regexp = "BONUS|ARREARS|REIMBURSEMENT|ALLOWANCE|OTHER_DEDUCTION") String type,
                                    @NotNull @Positive BigDecimal amount, @Size(max = 300) String description) { }

    public record AdjustmentResponse(String id, String employeeId, String payrollMonth, String type, BigDecimal amount, String description, String status, String appliedRunId, Instant createdAt) { }

    public record LoanRequest(@NotBlank @ValidEmployeeId String employeeId, @NotBlank @Size(max = 120) String description, @NotNull @Positive BigDecimal principal,
                              @NotNull @Positive BigDecimal emi, @NotBlank @Pattern(regexp = MONTH, message = "startMonth must be yyyy-MM") String startMonth) { }

    public record LoanResponse(String id, String employeeId, String description, BigDecimal principal, BigDecimal emi, BigDecimal outstanding, String startMonth, String status) { }

    // ---- payslips
    public record PayslipResponse(String id, String entryId, String runId, String employeeId, String payrollMonth, String fileName, long sizeBytes, Instant generatedAt,
                                  BigDecimal gross, BigDecimal net) { }

    // ---- reports
    public record MonthlyReport(String month, String status, int employees, BigDecimal totalGross, BigDecimal totalDeductions, BigDecimal totalNet, BigDecimal averageNet) { }

    public record ComponentTotal(String componentCode, String componentName, String type, BigDecimal total, long employees) { }

    public record DepartmentTotal(String departmentId, long employees, BigDecimal gross, BigDecimal deductions, BigDecimal net) { }
}
