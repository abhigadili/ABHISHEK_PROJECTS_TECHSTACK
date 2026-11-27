using Microsoft.EntityFrameworkCore;

namespace HR.AttendanceService.Data;

public partial class AttendanceDbContext
{
    partial void OnModelCreatingPartial(ModelBuilder modelBuilder) => ApplyHrConventions(modelBuilder);
}
