using Microsoft.EntityFrameworkCore;

namespace HR.ProjectService.Data;

public partial class ProjectDbContext
{
    partial void OnModelCreatingPartial(ModelBuilder modelBuilder) => ApplyHrConventions(modelBuilder);
}
