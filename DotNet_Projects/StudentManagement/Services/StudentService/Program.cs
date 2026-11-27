using Common;
using Common.Security;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Observability;
using StudentService.Data;
using StudentService.Entities;
using StudentService.Repositories;
using StudentService.Services;

var builder = WebApplication.CreateBuilder(args);
builder.AddSmsObservability("student-service");

// --- MySQL (StudentDB) via Pomelo; credentials come from ConnectionStrings__StudentDb (env) ---
var cs = builder.Configuration.GetConnectionString("StudentDb") ?? throw new InvalidOperationException("ConnectionStrings:StudentDb missing");
builder.Services.AddDbContext<StudentDbContext>(o => o.UseMySql(cs, new MySqlServerVersion(new Version(8, 0, 36)), my => my.EnableRetryOnFailure(3)));

builder.Services.AddIdentityCore<AppUser>(o =>
    {
        o.Password.RequiredLength = 8; o.Password.RequireDigit = true; o.Password.RequireLowercase = true;
        o.Password.RequireUppercase = false; o.Password.RequireNonAlphanumeric = false;
        o.User.RequireUniqueEmail = true;
        o.Lockout.MaxFailedAccessAttempts = 5; o.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(5); o.Lockout.AllowedForNewUsers = true;
    })
    .AddRoles<AppRole>().AddEntityFrameworkStores<StudentDbContext>();

builder.Services.AddSmsJwtAuth(builder.Configuration);
builder.Services.AddSmsRedis(builder.Configuration);
builder.Services.AddSmsControllers();
builder.Services.AddSmsWebDefaults("Student Service API", "Student profiles, user accounts, login (JWT) and refresh tokens.");
builder.Services.AddScoped<IStudentRepository, StudentRepository>();
builder.Services.AddScoped<IStudentAppService, StudentAppService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddHostedService<AdminSeeder>();
builder.Services.AddHealthChecks().AddDbContextCheck<StudentDbContext>("mysql", tags: new[] { "ready" });

var app = builder.Build();

// Non-destructive migrations: EF only adds the dn_* tables (+ __EFMigrationsHistory); nothing existing is dropped.
if (builder.Configuration.GetValue("Database:MigrateOnStartup", true))
{
    using var scope = app.Services.CreateScope();
    await scope.ServiceProvider.GetRequiredService<StudentDbContext>().Database.MigrateAsync();
}

app.UseSmsWebDefaults();
app.UseSmsObservability();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapSmsHealth();
app.Run();

public partial class Program { }
