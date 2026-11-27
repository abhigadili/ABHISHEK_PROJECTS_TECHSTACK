using System;
using System.Collections.Generic;

namespace HR.OrganizationService.Entities;

public partial class Organization
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public bool Deleted { get; set; }

    public DateTime? DeletedAt { get; set; }

    public string? Address { get; set; }

    public string? Email { get; set; }

    public DateOnly? FoundedOn { get; set; }

    public string? LegalName { get; set; }

    public string Name { get; set; } = null!;

    public string? Phone { get; set; }

    public string? RegistrationNumber { get; set; }

    public string? Website { get; set; }

    public virtual ICollection<BusinessUnit> BusinessUnits { get; set; } = new List<BusinessUnit>();
}
