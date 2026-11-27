using Common;
using Common.Security;
using Messaging;
using Microsoft.EntityFrameworkCore;
using NotificationService.Consumers;
using NotificationService.Data;
using NotificationService.Processing;
using NotificationService.Services;
using Observability;

var builder = WebApplication.CreateBuilder(args);
builder.AddSmsObservability("notification-service", MessagingTelemetry.SourceName);

var cs = builder.Configuration.GetConnectionString("NotificationDb") ?? throw new InvalidOperationException("ConnectionStrings:NotificationDb missing");
builder.Services.AddDbContext<NotificationDbContext>(o => o.UseMySql(cs, new MySqlServerVersion(new Version(8, 0, 36)), my => my.EnableRetryOnFailure(3)));

builder.Services.AddSmsJwtAuth(builder.Configuration);
builder.Services.AddSmsRabbitMq(builder.Configuration, publisher: false);
builder.Services.AddSmsControllers();
builder.Services.AddSmsWebDefaults("Notification Service API", "Notification history; notifications are created from RabbitMQ events.");
builder.Services.AddScoped<INotificationIngestService, NotificationIngestService>();
builder.Services.AddScoped<NotificationQueryService>();
builder.Services.AddScoped<NotificationProcessor>();
builder.Services.AddSingleton<EmailSimulator>();
// background processing
builder.Services.AddHostedService<EnrollmentEventsConsumer>();
builder.Services.AddHostedService<CourseEventsConsumer>();
builder.Services.AddHostedService<NotificationDispatcher>();
builder.Services.AddHealthChecks().AddDbContextCheck<NotificationDbContext>("mysql", tags: new[] { "ready" });

var app = builder.Build();
if (builder.Configuration.GetValue("Database:MigrateOnStartup", true))
{
    using var scope = app.Services.CreateScope();
    await scope.ServiceProvider.GetRequiredService<NotificationDbContext>().Database.MigrateAsync();
}
app.UseSmsWebDefaults();
app.UseSmsObservability();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapSmsHealth();
app.Run();

public partial class Program { }
