using Microsoft.EntityFrameworkCore;

namespace HR.OrganizationService.Data;

public partial class OrganizationDbContext
{
    partial void OnModelCreatingPartial(ModelBuilder modelBuilder) => ApplyHrConventions(modelBuilder);
}
