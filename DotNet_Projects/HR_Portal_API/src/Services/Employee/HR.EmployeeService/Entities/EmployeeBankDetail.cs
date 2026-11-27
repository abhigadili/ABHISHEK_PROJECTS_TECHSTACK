using System;
using System.Collections.Generic;

namespace HR.EmployeeService.Entities;

public partial class EmployeeBankDetail
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public string AccountHolderName { get; set; } = null!;

    public string AccountNumber { get; set; } = null!;

    public string? AccountType { get; set; }

    public string BankName { get; set; } = null!;

    public string? Branch { get; set; }

    public string? EmployeeId { get; set; }

    public string? IfscCode { get; set; }

    public virtual Employee? Employee { get; set; }
}
