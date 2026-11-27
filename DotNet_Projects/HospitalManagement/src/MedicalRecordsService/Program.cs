using HMS.Records.Data;
using HMS.Records.Services;
using HMS.Shared.Hosting;
using HMS.Shared.Messaging;
using Serilog;

Log.Logger = new LoggerConfiguration().WriteTo.Console().CreateBootstrapLogger();
try
{
    var builder = WebApplication.CreateBuilder(args);
    const string service = "medical-records-service";
    builder.AddHospitalCore(service);
    builder.ConfigureHospitalKestrel(28105);
    builder.AddHospitalPersistence<RecordsDbContext>(builder.Configuration["Database:Name"]!);
    builder.AddHospitalMessaging<RecordsDbContext>(service);
    builder.AddPatientGrpcClient();      // gRPC -> Patient Service
    builder.Services.AddScoped<IRecordService, RecordService>();
    builder.Services.AddScoped<IEventHandler, PatientRegisteredHandler>();
    builder.Services.AddScoped<IEventHandler, LabReportHandler>();
    builder.Services.AddScoped<IEventHandler, PrescriptionHandler>();
    builder.Services.AddScoped<IEventHandler, AppointmentCompletedHandler>();

    var app = builder.Build();
    app.UseHospitalPipeline();
    app.MapControllers();
    app.MapPing(service);
    await app.MigrateAsync<RecordsDbContext>();
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
