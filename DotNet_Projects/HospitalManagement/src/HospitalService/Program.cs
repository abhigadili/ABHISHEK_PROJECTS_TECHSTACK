using HMS.Hospitals.Data;
using HMS.Hospitals.Domain;
using HMS.Hospitals.Services;
using HMS.Shared.Hosting;
using Microsoft.AspNetCore.Identity;
using Serilog;

Log.Logger = new LoggerConfiguration().WriteTo.Console().CreateBootstrapLogger();
try
{
    var builder = WebApplication.CreateBuilder(args);
    const string service = "hospital-service";
    builder.AddHospitalCore(service);
    builder.ConfigureHospitalKestrel(28104);
    builder.AddHospitalPersistence<HospitalDbContext>(builder.Configuration["Database:Name"]!);
    builder.AddHospitalCache(service);

    // ASP.NET Core Identity: users, roles, password hashing, lockout. Tokens are issued by TokenService (JWT).
    builder.Services.AddIdentityCore<AppUser>(o =>
        {
            o.Password.RequiredLength = 8;
            o.Password.RequireDigit = true;
            o.Password.RequireUppercase = true;
            o.Password.RequireLowercase = true;
            o.Password.RequireNonAlphanumeric = false;
            o.User.RequireUniqueEmail = true;
            o.Lockout.MaxFailedAccessAttempts = 8;
            o.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(5);
        })
        .AddRoles<IdentityRole<long>>()
        .AddEntityFrameworkStores<HospitalDbContext>();
    builder.Services.AddSingleton<TokenService>();
    builder.Services.AddScoped<IAuthService, AuthService>();
    builder.Services.AddScoped<IHospitalAppService, HospitalAppService>();

    var app = builder.Build();
    app.UseHospitalPipeline();
    app.MapControllers();
    app.MapPing(service);
    await app.MigrateAsync<HospitalDbContext>();
    await DataSeeder.SeedAsync(app.Services);
    Log.Information("{Service} starting", service);
    await app.RunAsync();
}
catch (Exception ex) when (ex is not HostAbortedException)
{
    Log.Fatal(ex, "Service terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}
