using HR.Common.Hosting;
using HR.Common.Messaging;
using HR.NotificationService.Consumers;
using HR.NotificationService.Data;
using HR.NotificationService.Services;

var builder = WebApplication.CreateBuilder(args);
builder.AddHrService<NotificationDbContext>("HR.NotificationService", "hr_notification_db", 32114);
var s = builder.Services;
s.AddScoped<INotificationService, NotificationService>();
s.AddEmployeeReadModel<ContactReadModel>();
s.AddNotificationConsumers();

var app = builder.Build();
app.UseHrPipeline();
app.MapHrBasics("HR.NotificationService");
await app.RunHrAsync<NotificationDbContext>(["notifications", "notification_templates", "email_settings", "employee_contacts", "event_history", "audit_history"]);
