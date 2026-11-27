using Microsoft.EntityFrameworkCore;

namespace HR.ReportingService.Data;

public partial class ReportingDbContext
{
    partial void OnModelCreatingPartial(ModelBuilder modelBuilder) => ApplyHrConventions(modelBuilder);
}
