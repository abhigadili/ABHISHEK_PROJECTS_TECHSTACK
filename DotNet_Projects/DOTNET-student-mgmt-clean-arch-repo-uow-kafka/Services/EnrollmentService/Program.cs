using FluentValidation;
using StudentMgmt.BuildingBlocks.Common.Extensions;
using StudentMgmt.BuildingBlocks.Messaging;
using StudentMgmt.EnrollmentService.Kafka.Consumers;
using StudentMgmt.EnrollmentService.Kafka.Producers;
using StudentMgmt.EnrollmentService.Persistence;
using StudentMgmt.EnrollmentService.Services;
using StudentMgmt.EnrollmentService.Services.Interfaces;
using StudentMgmt.EnrollmentService.UnitOfWork;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);
builder.Host.UseAppSerilog("EnrollmentService");

builder.Services.AddControllers();
builder.Services.AddAppApiVersioning();
builder.Services.AddAppSwagger("Enrollment Service API");
builder.Services.AddAppCors(builder.Configuration);
builder.Services.AddJwtAuthentication(builder.Configuration);
builder.Services.AddKafkaMessaging(builder.Configuration);
builder.Services.AddSharedCommonServices();
builder.Services.AddAutoMapper(typeof(Program));
builder.Services.AddValidatorsFromAssemblyContaining<Program>();

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")!;
builder.Services.AddDbContext<EnrollmentDbContext>(options =>
    options.UseMySql(connectionString, new MySqlServerVersion(new Version(8, 0, 36))));
builder.Services.AddAppHealthChecks(connectionString, builder.Configuration["Kafka:BootstrapServers"]!);

builder.Services.AddScoped<IEnrollmentUnitOfWork, EnrollmentUnitOfWork>();
builder.Services.AddScoped<IEnrollmentAppService, EnrollmentAppService>();
builder.Services.AddScoped<ISnapshotSyncService, SnapshotSyncService>();
builder.Services.AddScoped<EnrollmentEventPublisher>();
builder.Services.AddHostedService<StudentEventsConsumer>();
builder.Services.AddHostedService<CourseEventsConsumer>();

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
    var db = scope.ServiceProvider.GetRequiredService<EnrollmentDbContext>();
    db.Database.Migrate();
}

app.Run();

/// <summary>Exposed for WebApplicationFactory-style integration tests, if added later.</summary>
public partial class Program
{
}
