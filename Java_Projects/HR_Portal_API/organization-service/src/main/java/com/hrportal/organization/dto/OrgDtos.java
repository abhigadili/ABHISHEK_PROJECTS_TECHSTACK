package com.hrportal.organization.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Size;

public final class OrgDtos {
    private OrgDtos() {
    }

    public record OrganizationRequest(@NotBlank @Size(max = 150) String name, @Size(max = 200) String legalName,
                                      @Size(max = 60) String registrationNumber, @Size(max = 200) String website,
                                      @Email String email, @Size(max = 30) String phone, @Past LocalDate foundedOn,
                                      @Size(max = 300) String address) { }

    public record OrganizationResponse(String id, String name, String legalName, String registrationNumber, String website,
                                       String email, String phone, LocalDate foundedOn, String address) { }

    public record BusinessUnitRequest(@NotBlank String organizationId, @NotBlank @Size(max = 30) String code,
                                      @NotBlank @Size(max = 120) String name, String headEmployeeId, Boolean active) { }

    public record BusinessUnitResponse(String id, String organizationId, String code, String name, String headEmployeeId, boolean active) { }

    public record DepartmentRequest(@NotBlank @Size(max = 30) String code, @NotBlank @Size(max = 120) String name,
                                    String businessUnitId, String parentId, String headEmployeeId,
                                    @Size(max = 30) String costCenter, Boolean active) { }

    public record DepartmentResponse(String id, String code, String name, String businessUnitId, String parentId,
                                     String headEmployeeId, String costCenter, boolean active) { }

    public record DepartmentTreeNode(String id, String code, String name, String headEmployeeId, long employeeCount,
                                     List<DepartmentTreeNode> children) { }

    public record HeadRequest(@NotBlank String headEmployeeId) { }

    public record JobGradeRequest(@NotBlank @Size(max = 20) String code, @NotBlank @Size(max = 100) String name,
                                  @Min(1) Integer level, @PositiveOrZero BigDecimal minSalary,
                                  @PositiveOrZero BigDecimal maxSalary, @Size(min = 3, max = 3) String currency) { }

    public record JobGradeResponse(String id, String code, String name, int level, BigDecimal minSalary, BigDecimal maxSalary, String currency) { }

    public record DesignationRequest(@NotBlank @Size(max = 30) String code, @NotBlank @Size(max = 120) String title,
                                     String jobGradeId, @Size(max = 300) String description, Boolean active) { }

    public record DesignationResponse(String id, String code, String title, String jobGradeId, String description, boolean active) { }

    public record LocationRequest(@NotBlank @Size(max = 30) String code, @NotBlank @Size(max = 120) String name,
                                  String type, @Size(max = 200) String addressLine, @Size(max = 80) String city,
                                  @Size(max = 80) String state, @Size(max = 80) String country,
                                  @Size(max = 15) String postalCode, @Size(max = 50) String timezone, Boolean active) { }

    public record LocationResponse(String id, String code, String name, String type, String addressLine, String city,
                                   String state, String country, String postalCode, String timezone, boolean active) { }

    public record EmployeeNodeResponse(String employeeId, String employeeCode, String fullName, String email,
                                       String departmentId, String designationId, String locationId, String managerId,
                                       String status, LocalDate joiningDate) { }

    /** One box of the organization chart (recursive). */
    public record OrgChartNode(String employeeId, String employeeCode, String fullName, String designation, String department,
                               String status, int directReports, List<OrgChartNode> reports) { }

    public record ChainLink(String employeeId, String fullName, String managerId, int level) { }

    public record DepartmentHeadcount(String departmentId, String departmentName, long headcount, long sizeRank) { }
}
