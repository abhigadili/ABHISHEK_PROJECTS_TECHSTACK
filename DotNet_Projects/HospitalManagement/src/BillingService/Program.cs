using HMS.Billing.Clients;
using HMS.Billing.Data;
using HMS.Billing.Services;
using HMS.Shared.Hosting;
using HMS.Shared.Http;
using HMS.Shared.Messaging;
using Serilog;

Log.Logger = new LoggerConfiguration().WriteTo.Console().CreateBootstrapLogger();
try
{
    var builder = WebApplication.CreateBuilder(args);
    const string service = "billing-service";
    builder.AddHospitalCore(service);
    builder.ConfigureHospitalKestrel(28108);
    builder.AddHospitalPersistence<BillingDbContext>(builder.Configuration["Database:Name"]!);
    builder.AddHospitalMessaging<BillingDbContext>(service);
    builder.AddPatientGrpcClient();      // gRPC -> Patient Service
    builder.Services.AddHospitalHttpClient<IAppointmentDirectory, AppointmentClient>("appointment-service", builder.Configuration["Services:Appointment"] ?? "http://localhost:28103");
    builder.Services.AddSingleton<PaymentGatewaySimulator>();
    builder.Services.AddScoped<IBillingAppService, BillingAppService>();
    builder.Services.AddScoped<IEventHandler, AppointmentBookedHandler>();
    builder.Services.AddScoped<IEventHandler, AppointmentCancelledHandler>();
    builder.Services.AddScoped<IEventHandler, LabTestRequestedHandler>();
    builder.Services.AddScoped<IEventHandler, MedicineDispensedHandler>();
    builder.Services.AddHostedService<StalePaymentsJob>();
    builder.Services.AddHostedService<OverdueAndReminderJob>();

    var app = builder.Build();
    app.UseHospitalPipeline();
    app.MapControllers();
    app.MapPing(service);
    await app.MigrateAsync<BillingDbContext>();
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
