using Common;
using Common.Security;
using EnrollmentService.Clients;
using EnrollmentService.Commands;
using EnrollmentService.Data;
using EnrollmentService.EventHandlers;
using EnrollmentService.Outbox;
using EnrollmentService.Queries;
using EnrollmentService.Saga;
using Messaging;
using Microsoft.EntityFrameworkCore;
using Observability;

var builder = WebApplication.CreateBuilder(args);
builder.AddSmsObservability("enrollment-service", MessagingTelemetry.SourceName);

var cs = builder.Configuration.GetConnectionString("EnrollmentDb") ?? throw new InvalidOperationException("ConnectionStrings:EnrollmentDb missing");
builder.Services.AddDbContext<EnrollmentDbContext>(o => o.UseMySql(cs, new MySqlServerVersion(new Version(8, 0, 36)), my => my.EnableRetryOnFailure(3)));

builder.Services.AddSmsJwtAuth(builder.Configuration);
builder.Services.AddSmsRabbitMq(builder.Configuration, publisher: true);
builder.Services.AddSmsControllers();
builder.Services.AddSmsWebDefaults("Enrollment Service API", "Enrollment commands (saga, outbox) and queries (CQRS).");

// ---- synchronous communication: typed HttpClients + resilience (retry, circuit breaker, timeouts) - see Clients/ClientRegistration.cs
builder.Services.AddRemoteClients(builder.Configuration);

builder.Services.AddScoped<IEnrollmentEventRecorder, EnrollmentEventRecorder>();
builder.Services.AddScoped<EnrollmentSagaOrchestrator>();
builder.Services.AddScoped<CreateEnrollmentCommandHandler>();
builder.Services.AddScoped<CancelEnrollmentCommandHandler>();
builder.Services.AddScoped<UpdateEnrollmentCommandHandler>();
builder.Services.AddScoped<EnrollmentQueryHandlers>();
// ---- background processing ----------------------------------------------------------------------------------------------
builder.Services.AddSingleton<OutboxPublisher>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<OutboxPublisher>());
builder.Services.AddHostedService<SagaRecoveryJob>();
builder.Services.AddHealthChecks().AddDbContextCheck<EnrollmentDbContext>("mysql", tags: new[] { "ready" });

var app = builder.Build();
if (builder.Configuration.GetValue("Database:MigrateOnStartup", true))
{
    using var scope = app.Services.CreateScope();
    await scope.ServiceProvider.GetRequiredService<EnrollmentDbContext>().Database.MigrateAsync();
}
app.UseSmsWebDefaults();
app.UseSmsObservability();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapSmsHealth();
app.Run();

public partial class Program { }
