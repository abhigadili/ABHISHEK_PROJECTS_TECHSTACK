using FluentValidation;
using Microsoft.EntityFrameworkCore;
using StudentMgmt.BuildingBlocks.Common.Extensions;
using StudentMgmt.BuildingBlocks.Messaging;
using StudentMgmt.NotificationService.Kafka.Consumers;
using StudentMgmt.NotificationService.Kafka.Producers;
using StudentMgmt.NotificationService.Persistence;
using StudentMgmt.NotificationService.Services;
using StudentMgmt.NotificationService.Services.Interfaces;
using StudentMgmt.NotificationService.Services.Senders;
using StudentMgmt.NotificationService.UnitOfWork;

var builder = WebApplication.CreateBuilder(args);
builder.Host.UseAppSerilog("NotificationService");

builder.Services.AddControllers();
builder.Services.AddAppApiVersioning();
builder.Services.AddAppSwagger("Notification Service API");
builder.Services.AddAppCors(builder.Configuration);
builder.Services.AddJwtAuthentication(builder.Configuration);
builder.Services.AddKafkaMessaging(builder.Configuration);
builder.Services.AddSharedCommonServices();
builder.Services.AddAutoMapper(typeof(Program));
builder.Services.AddValidatorsFromAssemblyContaining<Program>();

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")!;
builder.Services.AddDbContext<NotificationDbContext>(options =>
    options.UseMySql(connectionString, new MySqlServerVersion(new Version(8, 0, 36))));
builder.Services.AddAppHealthChecks(connectionString, builder.Configuration["Kafka:BootstrapServers"]!);

builder.Services.AddScoped<INotificationUnitOfWork, NotificationUnitOfWork>();
builder.Services.AddScoped<INotificationAppService, NotificationAppService>();
builder.Services.AddScoped<NotificationEventPublisher>();
builder.Services.AddSingleton<IEmailSender, SmtpMockEmailSender>();
builder.Services.AddSingleton<ISmsSender, MockSmsSender>();
builder.Services.AddSingleton<IPushSender, MockPushSender>();
builder.Services.AddHostedService<UpstreamEventsConsumer>();

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
    var db = scope.ServiceProvider.GetRequiredService<NotificationDbContext>();
    db.Database.Migrate();
}

app.Run();

public partial class Program
{
}
