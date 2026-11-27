using System;
using System.Collections.Generic;

namespace HR.OrganizationService.Entities;

public partial class Location
{
    public string Id { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public bool Deleted { get; set; }

    public DateTime? DeletedAt { get; set; }

    public bool Active { get; set; }

    public string? AddressLine { get; set; }

    public string? City { get; set; }

    public string Code { get; set; } = null!;

    public string? Country { get; set; }

    public string Name { get; set; } = null!;

    public string? PostalCode { get; set; }

    public string? State { get; set; }

    public string? Timezone { get; set; }

    public string Type { get; set; } = null!;
}
