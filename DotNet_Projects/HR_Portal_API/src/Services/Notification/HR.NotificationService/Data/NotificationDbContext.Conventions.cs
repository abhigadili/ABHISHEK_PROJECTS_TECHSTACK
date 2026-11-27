using Microsoft.EntityFrameworkCore;

namespace HR.NotificationService.Data;

public partial class NotificationDbContext
{
    partial void OnModelCreatingPartial(ModelBuilder modelBuilder) => ApplyHrConventions(modelBuilder);
}
