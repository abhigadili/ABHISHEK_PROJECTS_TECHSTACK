using Microsoft.EntityFrameworkCore;

namespace HR.DocumentService.Data;

public partial class DocumentDbContext
{
    partial void OnModelCreatingPartial(ModelBuilder modelBuilder) => ApplyHrConventions(modelBuilder);
}
