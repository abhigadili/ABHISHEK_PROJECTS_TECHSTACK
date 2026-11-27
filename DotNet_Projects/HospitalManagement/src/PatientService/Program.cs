using HMS.Patients.Data;
using HMS.Patients.Grpc;
using HMS.Patients.Services;
using HMS.Shared.Hosting;
using Serilog;

Log.Logger = new LoggerConfiguration().WriteTo.Console().CreateBootstrapLogger();
try
{
    var builder = WebApplication.CreateBuilder(args);
    const string service = "patient-service";
    builder.AddHospitalCore(service);
    builder.ConfigureHospitalKestrel(28101, 28201);
    builder.AddHospitalPersistence<PatientDbContext>(builder.Configuration["Database:Name"]!);
    builder.AddHospitalMessaging<PatientDbContext>(service);
    builder.AddHospitalCache(service);
    builder.Services.AddGrpc();
    builder.Services.AddScoped<IPatientAppService, PatientAppService>();

    var app = builder.Build();
    app.UseHospitalPipeline();
    app.MapControllers();
    app.MapGrpcService<PatientGrpcService>();
    app.MapPing(service);
    await app.MigrateAsync<PatientDbContext>();
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
