using System;
using System.Collections.Generic;

namespace HR.EmployeeService.Entities;

public partial class Employee
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public bool Deleted { get; set; }

    public DateTime? DeletedAt { get; set; }

    public string? BloodGroup { get; set; }

    public DateOnly? ConfirmationDate { get; set; }

    public string? AlternatePhone { get; set; }

    public string? PersonalEmail { get; set; }

    public string? Phone { get; set; }

    public DateOnly? DateOfBirth { get; set; }

    public string DepartmentId { get; set; } = null!;

    public string DesignationId { get; set; } = null!;

    public string EmployeeCode { get; set; } = null!;

    public string EmploymentType { get; set; } = null!;

    public DateOnly? ExitDate { get; set; }

    public string FirstName { get; set; } = null!;

    public string? Gender { get; set; }

    public string? JobGradeId { get; set; }

    public DateOnly JoiningDate { get; set; }

    public string LastName { get; set; } = null!;

    public string LocationId { get; set; } = null!;

    public string? ManagerId { get; set; }

    public string? MaritalStatus { get; set; }

    public string? MiddleName { get; set; }

    public string? NationalId { get; set; }

    public string? Nationality { get; set; }

    public int NoticePeriodDays { get; set; }

    public string? PanNumber { get; set; }

    public string Status { get; set; } = null!;

    public long Version { get; set; }

    public string WorkEmail { get; set; } = null!;

    public virtual ICollection<EmergencyContact> EmergencyContacts { get; set; } = new List<EmergencyContact>();

    public virtual ICollection<EmployeeAddress> EmployeeAddresses { get; set; } = new List<EmployeeAddress>();

    public virtual ICollection<EmployeeBankDetail> EmployeeBankDetails { get; set; } = new List<EmployeeBankDetail>();

    public virtual ICollection<EmployeeEducation> EmployeeEducations { get; set; } = new List<EmployeeEducation>();
}
