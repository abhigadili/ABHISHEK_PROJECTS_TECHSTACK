using Microsoft.EntityFrameworkCore;

namespace HR.LeaveService.Data;

public partial class LeaveDbContext
{
    partial void OnModelCreatingPartial(ModelBuilder modelBuilder) => ApplyHrConventions(modelBuilder);
}
