using Microsoft.EntityFrameworkCore;

namespace HR.EmployeeService.Data;

public partial class EmployeeDbContext
{
    partial void OnModelCreatingPartial(ModelBuilder modelBuilder) => ApplyHrConventions(modelBuilder);
}
