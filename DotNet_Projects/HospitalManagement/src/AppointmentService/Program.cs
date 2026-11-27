using HMS.Appointments.Data;
using HMS.Appointments.Services;
using HMS.Shared.Hosting;
using HMS.Shared.Messaging;
using Serilog;

Log.Logger = new LoggerConfiguration().WriteTo.Console().CreateBootstrapLogger();
try
{
    var builder = WebApplication.CreateBuilder(args);
    const string service = "appointment-service";
    builder.AddHospitalCore(service);
    builder.ConfigureHospitalKestrel(28103);
    builder.AddHospitalPersistence<AppointmentDbContext>(builder.Configuration["Database:Name"]!);
    builder.AddHospitalMessaging<AppointmentDbContext>(service);
    builder.AddHospitalCache(service);
    builder.AddPatientGrpcClient();      // gRPC  -> Patient Service
    builder.AddDoctorHttpClient();       // HttpClient (+ Polly) -> Doctor Service
    builder.Services.AddScoped<IAppointmentAppService, AppointmentAppService>();
    builder.Services.AddScoped<IEventHandler, BillingGeneratedHandler>();
    builder.Services.AddScoped<IEventHandler, PaymentCompletedHandler>();
    builder.Services.AddScoped<IEventHandler, PaymentFailedHandler>();
    builder.Services.AddHostedService<ReminderJob>();
    builder.Services.AddHostedService<MissedAppointmentsJob>();

    var app = builder.Build();
    app.UseHospitalPipeline();
    app.MapControllers();
    app.MapPing(service);
    await app.MigrateAsync<AppointmentDbContext>();
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
