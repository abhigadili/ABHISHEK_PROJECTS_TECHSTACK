using Microsoft.EntityFrameworkCore;

namespace HR.TimesheetService.Data;

public partial class TimesheetDbContext
{
    partial void OnModelCreatingPartial(ModelBuilder modelBuilder) => ApplyHrConventions(modelBuilder);
}
