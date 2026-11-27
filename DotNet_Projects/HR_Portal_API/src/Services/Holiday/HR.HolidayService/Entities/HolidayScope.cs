using System;
using System.Collections.Generic;

namespace HR.HolidayService.Entities;

public partial class HolidayScope
{
    public string HolidayId { get; set; } = null!;

    public string ScopeId { get; set; } = null!;

    public string ScopeType { get; set; } = null!;

    public virtual Holiday Holiday { get; set; } = null!;
}
