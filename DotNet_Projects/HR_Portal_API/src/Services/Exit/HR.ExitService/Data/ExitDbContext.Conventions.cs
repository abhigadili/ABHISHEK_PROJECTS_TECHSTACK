using Microsoft.EntityFrameworkCore;

namespace HR.ExitService.Data;

public partial class ExitDbContext
{
    partial void OnModelCreatingPartial(ModelBuilder modelBuilder) => ApplyHrConventions(modelBuilder);
}
