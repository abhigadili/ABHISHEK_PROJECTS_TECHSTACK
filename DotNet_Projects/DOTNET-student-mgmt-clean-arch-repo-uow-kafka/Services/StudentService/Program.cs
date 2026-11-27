using FluentValidation;
using Microsoft.EntityFrameworkCore;
using StudentMgmt.BuildingBlocks.Common.Extensions;
using StudentMgmt.BuildingBlocks.Messaging;
using StudentMgmt.StudentService.Kafka.Producers;
using StudentMgmt.StudentService.Persistence;
using StudentMgmt.StudentService.Persistence.Seed;
using StudentMgmt.StudentService.Repositories;
using StudentMgmt.StudentService.Repositories.Interfaces;
using StudentMgmt.StudentService.Services;
using StudentMgmt.StudentService.Services.Interfaces;
using StudentMgmt.StudentService.UnitOfWork;

var builder = WebApplication.CreateBuilder(args);
builder.Host.UseAppSerilog("StudentService");

builder.Services.AddControllers();
builder.Services.AddAppApiVersioning();
builder.Services.AddAppSwagger("Student Service API");
builder.Services.AddAppCors(builder.Configuration);
builder.Services.AddJwtAuthentication(builder.Configuration);
builder.Services.AddKafkaMessaging(builder.Configuration);
builder.Services.AddSharedCommonServices();
builder.Services.AddAutoMapper(typeof(Program));
builder.Services.AddValidatorsFromAssemblyContaining<Program>();

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")!;
builder.Services.AddDbContext<StudentDbContext>(options =>
    options.UseMySql(connectionString, new MySqlServerVersion(new Version(8, 0, 36))));
builder.Services.AddAppHealthChecks(connectionString, builder.Configuration["Kafka:BootstrapServers"]!);

builder.Services.AddScoped<IStudentRepository, StudentRepository>();
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IRoleRepository, RoleRepository>();
builder.Services.AddScoped<IRefreshTokenRepository, RefreshTokenRepository>();
builder.Services.AddScoped<IStudentUnitOfWork, StudentUnitOfWork>();
builder.Services.AddScoped<IStudentAppService, StudentAppService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<StudentEventPublisher>();

var app = builder.Build();

app.UseSharedMiddlewares();
app.UseCors(StudentMgmt.BuildingBlocks.Common.Extensions.CorsServiceExtensions.PolicyName);
app.UseSwagger();
app.UseSwaggerUI();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHealthChecks("/health");

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<StudentDbContext>();
    db.Database.Migrate();
    await DbSeeder.SeedAsync(scope.ServiceProvider);
}

app.Run();

/// <summary>Exposed so WebApplicationFactory-based integration tests can reference the entry point type.</summary>
public partial class Program { }
