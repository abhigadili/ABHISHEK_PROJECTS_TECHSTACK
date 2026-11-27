using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace NotificationService.Data;

/// <summary>Used only by "dotnet ef" (never starts the web host). Connection: env ConnectionStrings__NotificationDb.</summary>
public class DesignTimeFactory : IDesignTimeDbContextFactory<NotificationDbContext>
{
    public NotificationDbContext CreateDbContext(string[] args)
    {
        var cs = Environment.GetEnvironmentVariable("ConnectionStrings__NotificationDb") ?? "Server=localhost;Database=NotificationDB;User=design;Password=design;";
        return new NotificationDbContext(new DbContextOptionsBuilder<NotificationDbContext>().UseMySql(cs, new MySqlServerVersion(new Version(8, 0, 36))).Options);
    }
}
