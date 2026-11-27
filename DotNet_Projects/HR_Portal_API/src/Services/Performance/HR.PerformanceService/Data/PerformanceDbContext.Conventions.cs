using Microsoft.EntityFrameworkCore;

namespace HR.PerformanceService.Data;

public partial class PerformanceDbContext
{
    partial void OnModelCreatingPartial(ModelBuilder modelBuilder) => ApplyHrConventions(modelBuilder);
}
