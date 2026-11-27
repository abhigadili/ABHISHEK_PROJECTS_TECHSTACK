using Microsoft.EntityFrameworkCore;

namespace HR.TaxService.Data;

public partial class TaxDbContext
{
    partial void OnModelCreatingPartial(ModelBuilder modelBuilder) => ApplyHrConventions(modelBuilder);
}
