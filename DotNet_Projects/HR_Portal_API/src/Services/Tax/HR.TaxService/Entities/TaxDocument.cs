using System;
using System.Collections.Generic;

namespace HR.TaxService.Entities;

public partial class TaxDocument
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public string DocType { get; set; } = null!;

    public string DocumentId { get; set; } = null!;

    public string EmployeeId { get; set; } = null!;

    public string? FileName { get; set; }

    public string FinancialYear { get; set; } = null!;
}
