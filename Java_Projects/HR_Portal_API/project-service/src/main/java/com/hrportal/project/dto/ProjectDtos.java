package com.hrportal.project.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.hrportal.common.validation.DateRangeAware;
import com.hrportal.common.validation.ValidDateRange;
import com.hrportal.common.validation.ValidEmployeeId;
import com.hrportal.project.validation.AllocationPercent;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public final class ProjectDtos {
    private ProjectDtos() {
    }

    public record CustomerRequest(@NotBlank @Size(max = 30) String code, @NotBlank @Size(max = 150) String name, @Size(max = 80) String industry,
                                  @Size(max = 200) String website, @Size(max = 300) String billingAddress, @Email String billingEmail,
                                  @Size(max = 40) String taxNumber, @Min(0) Integer paymentTermsDays, @PositiveOrZero BigDecimal creditLimit,
                                  @Pattern(regexp = "ACTIVE|INACTIVE") String status, @Size(max = 500) String notes) { }

    public record CustomerResponse(String id, String code, String name, String industry, String website, String billingAddress, String billingEmail,
                                   int paymentTermsDays, BigDecimal creditLimit, String status, String notes, Instant createdAt) { }

    public record ContactRequest(@NotBlank @Size(max = 120) String name, @Email String email, @Size(max = 25) String phone,
                                 @Size(max = 100) String designation, Boolean primaryContact) { }

    public record ContactResponse(String id, String customerId, String name, String email, String phone, String designation, boolean primaryContact) { }

    @ValidDateRange
    public record ProjectRequest(@NotBlank @Size(max = 30) String code, @NotBlank @Size(max = 150) String name, @Size(max = 1000) String description,
                                 @NotBlank String customerId, @NotBlank @ValidEmployeeId String projectManagerId, @NotNull LocalDate startDate,
                                 LocalDate endDate, @PositiveOrZero BigDecimal budget, @Size(min = 3, max = 3) String currency,
                                 @Pattern(regexp = "TIME_AND_MATERIAL|FIXED_PRICE|RETAINER|NON_BILLABLE") String billingModel,
                                 @PositiveOrZero BigDecimal billingRate, String billingContactId, @Size(max = 500) String billingNotes) implements DateRangeAware {
        @JsonIgnore
        @Override
        public LocalDate rangeStart() {
            return startDate;
        }

        @JsonIgnore
        @Override
        public LocalDate rangeEnd() {
            return endDate;
        }
    }

    public record ProjectUpdateRequest(@Size(max = 150) String name, @Size(max = 1000) String description, LocalDate endDate, @PositiveOrZero BigDecimal budget,
                                       @Pattern(regexp = "TIME_AND_MATERIAL|FIXED_PRICE|RETAINER|NON_BILLABLE") String billingModel,
                                       @PositiveOrZero BigDecimal billingRate, String billingContactId, @Size(max = 500) String billingNotes) { }

    public record ProjectResponse(String id, String code, String name, String description, String customerId, String projectManagerId, LocalDate startDate,
                                  LocalDate endDate, String status, BigDecimal budget, String currency, String billingModel, BigDecimal billingRate,
                                  String billingContactId, String billingNotes, long version, Instant createdAt) { }

    public record StatusRequest(@NotBlank @Pattern(regexp = "PLANNED|ACTIVE|ON_HOLD|COMPLETED|CANCELLED") String status, @Size(max = 300) String reason) { }

    public record ManagerRequest(@NotBlank @ValidEmployeeId String projectManagerId) { }

    @ValidDateRange
    public record AllocationRequest(@NotBlank @ValidEmployeeId String employeeId, @NotBlank @Size(max = 80) String role,
                                    @NotNull @AllocationPercent BigDecimal allocationPercent, @NotNull LocalDate startDate, LocalDate endDate,
                                    Boolean billable) implements DateRangeAware {
        @JsonIgnore
        @Override
        public LocalDate rangeStart() {
            return startDate;
        }

        @JsonIgnore
        @Override
        public LocalDate rangeEnd() {
            return endDate;
        }
    }

    public record AllocationResponse(String id, String projectId, String employeeId, String employeeName, String role, BigDecimal allocationPercent,
                                     LocalDate startDate, LocalDate endDate, boolean billable, String status) { }

    public record HistoryResponse(String id, String projectId, String changeType, String oldValue, String newValue, String createdBy, Instant createdAt) { }

    /** Answer to "may this employee book time on this project on this date?" - used by the Timesheet service. */
    public record AllocationCheck(String projectId, String employeeId, LocalDate date, boolean allocated, BigDecimal allocationPercent, boolean billable,
                                  String projectStatus, String projectManagerId) { }

    public record EmployeeProject(String projectId, String projectCode, String projectName, String projectStatus, String customerId, String role,
                                  BigDecimal allocationPercent, LocalDate startDate, LocalDate endDate, boolean billable, String allocationStatus) { }

    public record AllocationSummaryRow(String projectId, String projectCode, String projectName, String role, BigDecimal allocationPercent, boolean billable) { }

    public record AllocationSummary(String employeeId, LocalDate date, BigDecimal totalPercent, BigDecimal availablePercent, List<AllocationSummaryRow> allocations) { }
}
