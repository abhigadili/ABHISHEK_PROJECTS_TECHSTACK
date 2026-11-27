using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace StudentService.Data;

/// <summary>Used only by "dotnet ef" so tooling never starts the web host (which would apply migrations). Connection: env ConnectionStrings__StudentDb.</summary>
public class DesignTimeFactory : IDesignTimeDbContextFactory<StudentDbContext>
{
    public StudentDbContext CreateDbContext(string[] args)
    {
        var cs = Environment.GetEnvironmentVariable("ConnectionStrings__StudentDb") ?? "Server=localhost;Database=StudentDB;User=design;Password=design;";
        return new StudentDbContext(new DbContextOptionsBuilder<StudentDbContext>().UseMySql(cs, new MySqlServerVersion(new Version(8, 0, 36))).Options);
    }
}
