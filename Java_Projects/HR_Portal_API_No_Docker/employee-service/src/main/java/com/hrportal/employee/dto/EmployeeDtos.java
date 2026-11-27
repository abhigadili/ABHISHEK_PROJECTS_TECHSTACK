package com.hrportal.employee.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.hrportal.common.validation.ValidEmployeeId;
import com.hrportal.employee.entity.Enums.EmployeeStatus;

import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Request / response records of the Employee API (entities are never exposed). */
public final class EmployeeDtos {
    private EmployeeDtos() {
    }

    private static final String GENDER = "MALE|FEMALE|OTHER|UNDISCLOSED";
    private static final String MARITAL = "SINGLE|MARRIED|DIVORCED|WIDOWED";
    private static final String EMP_TYPE = "FULL_TIME|PART_TIME|CONTRACT|INTERN";
    private static final String PHONE = "^\\+?[0-9 ()-]{7,20}$";

    public record ContactDto(@Pattern(regexp = PHONE, message = "invalid phone number") String phone,
                             @Pattern(regexp = PHONE, message = "invalid phone number") String alternatePhone,
                             @Email String personalEmail) { }

    public record EmployeeRequest(
            @NotBlank @Size(max = 80) String firstName, @Size(max = 80) String middleName, @NotBlank @Size(max = 80) String lastName,
            @NotBlank @Email @Size(max = 150) String workEmail, @Past LocalDate dateOfBirth,
            @Pattern(regexp = GENDER) String gender, @Pattern(regexp = MARITAL) String maritalStatus,
            @Size(max = 60) String nationality, @Pattern(regexp = "^(A|B|AB|O)[+-]$", message = "blood group like O+ or AB-") String bloodGroup,
            @NotNull LocalDate joiningDate, @Pattern(regexp = EMP_TYPE) String employmentType,
            @NotBlank @ValidEmployeeId String departmentId, @NotBlank @ValidEmployeeId String designationId,
            @NotBlank @ValidEmployeeId String locationId, @ValidEmployeeId String managerId, @ValidEmployeeId String jobGradeId,
            @Min(0) @Max(180) Integer noticePeriodDays,
            @Pattern(regexp = "^[A-Z]{5}[0-9]{4}[A-Z]$", message = "PAN must look like ABCDE1234F") String panNumber,
            @Size(max = 40) String nationalId, @Valid ContactDto contact) { }

    /** Partial update: every field is optional, absent (null) fields are left untouched. */
    public record EmployeeUpdateRequest(
            @Size(max = 80) String firstName, @Size(max = 80) String middleName, @Size(max = 80) String lastName,
            @Email @Size(max = 150) String workEmail, @Past LocalDate dateOfBirth,
            @Pattern(regexp = GENDER) String gender, @Pattern(regexp = MARITAL) String maritalStatus,
            @Size(max = 60) String nationality, @Pattern(regexp = "^(A|B|AB|O)[+-]$") String bloodGroup,
            LocalDate confirmationDate, @Pattern(regexp = EMP_TYPE) String employmentType, @Min(0) @Max(180) Integer noticePeriodDays,
            @Pattern(regexp = "^[A-Z]{5}[0-9]{4}[A-Z]$", message = "PAN must look like ABCDE1234F") String panNumber,
            @Size(max = 40) String nationalId, @Valid ContactDto contact, Long expectedVersion) { }

    public record SelfContactUpdate(@Valid @NotNull ContactDto contact) { }

    public record EmployeeResponse(
            String id, String employeeCode, String firstName, String middleName, String lastName, String fullName, String workEmail,
            LocalDate dateOfBirth, String gender, String maritalStatus, String nationality, String bloodGroup,
            LocalDate joiningDate, LocalDate confirmationDate, String employmentType, String status,
            String departmentId, String designationId, String locationId, String managerId, String jobGradeId,
            int noticePeriodDays, LocalDate exitDate, String panMasked, ContactDto contact, long version,
            Instant createdAt, Instant updatedAt) { }

    /** Non-sensitive view used by other services (leave, payroll, exit ...). */
    public record EmployeeSummary(String id, String employeeCode, String fullName, String workEmail, String departmentId,
                                  String designationId, String locationId, String managerId, String jobGradeId,
                                  String status, String employmentType, LocalDate joiningDate, String gender,
                                  int noticePeriodDays, LocalDate exitDate) { }

    public record DirectoryEntry(String id, String employeeCode, String fullName, String workEmail, String departmentId,
                                 String designationId, String locationId, String status) { }

    public record DirectoryGroups(int total, Map<String, List<DirectoryEntry>> byInitial, Map<String, Long> byStatus) { }

    public record TeamMember(String id, String employeeCode, String firstName, String lastName, String workEmail,
                             String designationId, EmployeeStatus status) { }

    public record StatusChangeRequest(@NotBlank @Pattern(regexp = "ACTIVE|INACTIVE|ON_NOTICE|RESIGNED|TERMINATED") String status,
                                      @Size(max = 300) String reason, LocalDate effectiveDate) { }

    public record ManagerChangeRequest(@ValidEmployeeId String managerId, @Size(max = 300) String reason) { }

    public record TransferRequest(@ValidEmployeeId String departmentId, @ValidEmployeeId String designationId,
                                  @ValidEmployeeId String locationId, @ValidEmployeeId String jobGradeId,
                                  @NotNull LocalDate effectiveDate, @Size(max = 300) String reason, Boolean promotion) { }

    public record LookupRequest(@NotEmpty @Size(max = 200) List<@NotBlank String> ids) { }

    public record EmployeeSearchCriteria(String q, String status, String employmentType, String departmentId, String designationId,
                                         String locationId, String managerId, LocalDate joinedFrom, LocalDate joinedTo) { }

    // ---- sub-resources
    public record AddressRequest(@NotBlank @Pattern(regexp = "CURRENT|PERMANENT|OFFICE|MAILING") String type,
                                 @NotBlank @Size(max = 150) String line1, @Size(max = 150) String line2,
                                 @NotBlank @Size(max = 80) String city, @Size(max = 80) String state,
                                 @NotBlank @Size(max = 80) String country, @Size(max = 15) String postalCode, Boolean primaryAddress) { }

    public record AddressResponse(String id, String type, String line1, String line2, String city, String state,
                                  String country, String postalCode, boolean primaryAddress) { }

    public record EmergencyContactRequest(@NotBlank @Size(max = 120) String name, @NotBlank @Size(max = 50) String relationship,
                                          @NotBlank @Pattern(regexp = PHONE) String phone, @Pattern(regexp = PHONE) String alternatePhone,
                                          @Email String email, Boolean primaryContact) { }

    public record EmergencyContactResponse(String id, String name, String relationship, String phone, String alternatePhone,
                                           String email, boolean primaryContact) { }

    public record EducationRequest(@NotBlank @Size(max = 120) String degree, @NotBlank @Size(max = 200) String institution,
                                   @Size(max = 120) String fieldOfStudy, @Min(1950) @Max(2100) Integer startYear,
                                   @Min(1950) @Max(2100) Integer endYear, @Size(max = 40) String grade) {
        @JsonIgnore
        @AssertTrue(message = "endYear must not be before startYear")
        public boolean isYearRangeValid() {
            return startYear == null || endYear == null || endYear >= startYear;
        }
    }

    public record EducationResponse(String id, String employeeId, String degree, String institution, String fieldOfStudy,
                                    Integer startYear, Integer endYear, String grade) { }

    public record ExperienceRequest(@NotBlank @Size(max = 150) String company, @NotBlank @Size(max = 120) String jobTitle,
                                    @NotNull @Past LocalDate startDate, LocalDate endDate, @Size(max = 500) String description) {
        @JsonIgnore
        @AssertTrue(message = "endDate must not be before startDate")
        public boolean isDateRangeValid() {
            return endDate == null || !endDate.isBefore(startDate);
        }
    }

    public record ExperienceResponse(String id, String employeeId, String company, String jobTitle, LocalDate startDate,
                                     LocalDate endDate, String description, boolean verified) { }

    public record BankDetailRequest(@NotBlank @Size(max = 120) String bankName, @Size(max = 120) String branch,
                                    @NotBlank @Size(max = 120) String accountHolderName,
                                    @NotBlank @Pattern(regexp = "^[0-9]{6,20}$", message = "account number must be 6-20 digits") String accountNumber,
                                    @Pattern(regexp = "^[A-Z]{4}0[A-Z0-9]{6}$", message = "invalid IFSC code") String ifscCode,
                                    @Pattern(regexp = "SAVINGS|CURRENT|SALARY") String accountType) { }

    public record BankDetailResponse(String id, String employeeId, String bankName, String branch, String accountHolderName,
                                     String accountNumberMasked, String ifscMasked, String accountType, Instant updatedAt) { }

    public record EmploymentHistoryResponse(String id, String employeeId, String changeType, String fromValue, String toValue,
                                            LocalDate effectiveDate, String reason, String createdBy, Instant createdAt) { }

    public record ProfileChangeResponse(String id, String employeeId, String fieldName, String oldValue, String newValue,
                                        String createdBy, Instant createdAt) { }

    public record StatusHistoryResponse(Long id, String employeeId, String oldStatus, String newStatus, Instant changedAt, String changedBy) { }

    // ---- analytics rows (criteria / native queries)
    public record DepartmentStatusCount(String departmentId, String status, long count) { }

    public record ManagerSpan(String managerId, long directReports) { }
}
