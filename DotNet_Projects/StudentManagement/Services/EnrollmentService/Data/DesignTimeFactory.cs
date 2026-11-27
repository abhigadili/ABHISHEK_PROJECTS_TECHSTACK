using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace EnrollmentService.Data;

/// <summary>Used only by "dotnet ef" (never starts the web host). Connection: env ConnectionStrings__EnrollmentDb.</summary>
public class DesignTimeFactory : IDesignTimeDbContextFactory<EnrollmentDbContext>
{
    public EnrollmentDbContext CreateDbContext(string[] args)
    {
        var cs = Environment.GetEnvironmentVariable("ConnectionStrings__EnrollmentDb") ?? "Server=localhost;Database=EnrollmentDB;User=design;Password=design;";
        return new EnrollmentDbContext(new DbContextOptionsBuilder<EnrollmentDbContext>().UseMySql(cs, new MySqlServerVersion(new Version(8, 0, 36))).Options);
    }
}
