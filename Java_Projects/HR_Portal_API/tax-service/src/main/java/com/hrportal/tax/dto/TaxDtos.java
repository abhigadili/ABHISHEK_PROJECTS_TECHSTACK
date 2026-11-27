package com.hrportal.tax.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import com.hrportal.common.validation.ValidEmployeeId;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public final class TaxDtos {
    private TaxDtos() {
    }

    private static final String FY = "^\\d{4}-\\d{2}$";
    private static final String MONTH = "^\\d{4}-(0[1-9]|1[0-2])$";

    // ---- rules
    public record SlabDto(@NotNull @PositiveOrZero BigDecimal from, BigDecimal to, @NotNull @PositiveOrZero BigDecimal rate) { }

    public record RuleRequest(@NotBlank @Pattern(regexp = FY, message = "financialYear like 2026-27") String financialYear, @NotBlank @Pattern(regexp = "OLD|NEW") String regime,
                              @NotEmpty List<@Valid SlabDto> slabs, Map<String, BigDecimal> sectionLimits, @NotNull @PositiveOrZero BigDecimal standardDeduction,
                              @NotNull @PositiveOrZero BigDecimal cessPercent, @NotNull @PositiveOrZero BigDecimal rebateLimit, @NotNull @PositiveOrZero BigDecimal rebateAmount,
                              Boolean active) { }

    public record RuleResponse(String id, String financialYear, String regime, List<SlabDto> slabs, Map<String, BigDecimal> sectionLimits, BigDecimal standardDeduction,
                               BigDecimal cessPercent, BigDecimal rebateLimit, BigDecimal rebateAmount, boolean active) { }

    // ---- declarations
    public record InvestmentRequest(@NotBlank @Pattern(regexp = "^[A-Za-z0-9_]{2,20}$", message = "section such as 80C, 80D, HRA") String section,
                                    @NotBlank @Size(max = 200) String description, @NotNull @Positive BigDecimal declaredAmount) { }

    public record DeclarationRequest(@NotBlank @Pattern(regexp = FY) String financialYear, @NotBlank @Pattern(regexp = "OLD|NEW") String regime,
                                     @Valid List<InvestmentRequest> investments) { }

    public record ProofResponse(String id, String investmentId, String documentId, String fileName, String status, String reviewerComment, Instant reviewedAt, int attemptNumber, Instant createdAt) { }

    public record InvestmentResponse(String id, String section, String description, BigDecimal declaredAmount, BigDecimal approvedAmount, String status, List<ProofResponse> proofs) { }

    public record DeclarationResponse(String id, String employeeId, String employeeName, String financialYear, String regime, String status, BigDecimal totalDeclared,
                                      BigDecimal totalApproved, Instant submittedAt, String reviewerId, String reviewComment, Instant reviewedAt, List<InvestmentResponse> investments) { }

    public record DecisionRequest(@Size(max = 500) String comment) { }

    public record ProofRequest(@NotBlank @Size(max = 36) String documentId, @Size(max = 255) String fileName) { }

    public record VerifyProofRequest(@PositiveOrZero BigDecimal approvedAmount, @Size(max = 500) String comment) { }

    public record HistoryResponse(String id, String declarationId, String action, String status, BigDecimal totalDeclared, String comment, String createdBy, Instant createdAt) { }

    // ---- computation
    public record ComputationResponse(String employeeId, String financialYear, String regime, BigDecimal grossIncome, BigDecimal standardDeduction, BigDecimal totalDeductions,
                                      BigDecimal taxableIncome, BigDecimal slabTax, BigDecimal rebate, BigDecimal cess, BigDecimal totalTax, boolean declarationApproved, Instant computedAt) { }

    public record MonthlyTdsResponse(String employeeId, String month, BigDecimal tds, String regime, boolean declarationApproved) { }

    public record MonthRow(String month, BigDecimal tds) { }

    public record IncomeTaxStatement(String employeeId, String financialYear, ComputationResponse computation, List<MonthRow> months, BigDecimal tdsDeductedToDate, BigDecimal balanceTax) { }

    // ---- documents
    public record TaxDocumentRequest(@NotBlank @ValidEmployeeId String employeeId, @NotBlank @Pattern(regexp = FY) String financialYear,
                                     @NotBlank @Pattern(regexp = "FORM16_PART_A|FORM16_PART_B|TAX_STATEMENT|OTHER") String docType, @NotBlank @Size(max = 36) String documentId,
                                     @Size(max = 255) String fileName) { }

    public record TaxDocumentResponse(String id, String employeeId, String financialYear, String docType, String documentId, String fileName, Instant createdAt) { }

    public record StatusSummary(String financialYear, Map<String, Long> byStatus, long total) { }
}
