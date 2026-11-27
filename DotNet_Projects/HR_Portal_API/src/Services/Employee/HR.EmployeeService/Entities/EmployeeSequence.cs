using System;
using System.Collections.Generic;

namespace HR.EmployeeService.Entities;

public partial class EmployeeSequence
{
    public int Id { get; set; }

    public long NextValue { get; set; }
}
