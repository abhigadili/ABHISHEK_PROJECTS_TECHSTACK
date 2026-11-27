using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace CourseService.Data;

/// <summary>Used only by "dotnet ef" (never starts the web host). Connection: env ConnectionStrings__CourseDb.</summary>
public class DesignTimeFactory : IDesignTimeDbContextFactory<CourseDbContext>
{
    public CourseDbContext CreateDbContext(string[] args)
    {
        var cs = Environment.GetEnvironmentVariable("ConnectionStrings__CourseDb") ?? "Server=localhost;Database=CourseDB;User=design;Password=design;";
        return new CourseDbContext(new DbContextOptionsBuilder<CourseDbContext>().UseMySql(cs, new MySqlServerVersion(new Version(8, 0, 36))).Options);
    }
}
