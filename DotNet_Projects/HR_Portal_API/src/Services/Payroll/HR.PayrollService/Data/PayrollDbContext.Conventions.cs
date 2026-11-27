using Microsoft.EntityFrameworkCore;

namespace HR.PayrollService.Data;

public partial class PayrollDbContext
{
    partial void OnModelCreatingPartial(ModelBuilder modelBuilder) => ApplyHrConventions(modelBuilder);
}
