using Microsoft.EntityFrameworkCore;

namespace HR.AuthService.Data;

public partial class AuthDbContext
{
    partial void OnModelCreatingPartial(ModelBuilder modelBuilder) => ApplyHrConventions(modelBuilder);
}
