using HMS.Notifications.Data;
using HMS.Notifications.Services;
using HMS.Shared.Hosting;
using HMS.Shared.Messaging;
using Serilog;

Log.Logger = new LoggerConfiguration().WriteTo.Console().CreateBootstrapLogger();
try
{
    var builder = WebApplication.CreateBuilder(args);
    const string service = "notification-service";
    builder.AddHospitalCore(service);
    builder.ConfigureHospitalKestrel(28110);
    builder.AddHospitalPersistence<NotificationDbContext>(builder.Configuration["Database:Name"]!);
    builder.AddHospitalMessaging<NotificationDbContext>(service);
    builder.Services.AddScoped<INotificationAppService, NotificationAppService>();
    foreach (var handler in new[]
             {
                 typeof(PatientRegisteredHandler), typeof(AppointmentBookedHandler), typeof(AppointmentCancelledHandler), typeof(AppointmentRescheduledHandler),
                 typeof(LabReportHandler), typeof(PrescriptionHandler), typeof(BillingGeneratedHandler), typeof(PaymentCompletedHandler), typeof(PaymentFailedHandler),
                 typeof(MedicineDispensedHandler), typeof(NotificationRequestedHandler)
             })
        builder.Services.AddScoped(typeof(IEventHandler), handler);
    builder.Services.AddHostedService<NotificationDeliveryJob>();

    var app = builder.Build();
    app.UseHospitalPipeline();
    app.MapControllers();
    app.MapPing(service);
    await app.MigrateAsync<NotificationDbContext>();
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
