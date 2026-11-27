using System;
using System.Collections.Generic;

namespace HR.ProjectService.Entities;

public partial class Customer
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public bool Deleted { get; set; }

    public DateTime? DeletedAt { get; set; }

    public string? BillingAddress { get; set; }

    public string? BillingEmail { get; set; }

    public string Code { get; set; } = null!;

    public decimal? CreditLimit { get; set; }

    public string? Industry { get; set; }

    public string Name { get; set; } = null!;

    public string? Notes { get; set; }

    public int PaymentTermsDays { get; set; }

    public string Status { get; set; } = null!;

    public string? TaxNumber { get; set; }

    public string? Website { get; set; }

    public virtual ICollection<CustomerContact> CustomerContacts { get; set; } = new List<CustomerContact>();

    public virtual ICollection<Project> Projects { get; set; } = new List<Project>();
}
