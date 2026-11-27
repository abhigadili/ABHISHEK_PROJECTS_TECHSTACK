using Microsoft.EntityFrameworkCore;

namespace HR.HolidayService.Data;

public partial class HolidayDbContext
{
    partial void OnModelCreatingPartial(ModelBuilder modelBuilder) => ApplyHrConventions(modelBuilder);
}
