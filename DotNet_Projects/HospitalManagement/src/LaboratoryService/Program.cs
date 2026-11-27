using HMS.Laboratory.Data;
using HMS.Laboratory.Services;
using HMS.Shared.Hosting;
using HMS.Shared.Messaging;
using Serilog;

Log.Logger = new LoggerConfiguration().WriteTo.Console().CreateBootstrapLogger();
try
{
    var builder = WebApplication.CreateBuilder(args);
    const string service = "laboratory-service";
    builder.AddHospitalCore(service);
    builder.ConfigureHospitalKestrel(28107);
    builder.AddHospitalPersistence<LaboratoryDbContext>(builder.Configuration["Database:Name"]!);
    builder.AddHospitalMessaging<LaboratoryDbContext>(service);
    builder.AddPatientGrpcClient();      // gRPC -> Patient Service
    builder.AddDoctorHttpClient();       // HttpClient (+ Polly) -> Doctor Service
    builder.Services.AddScoped<ILabAppService, LabAppService>();
    builder.Services.AddScoped<IEventHandler, LabTestRequestedHandler>();

    var app = builder.Build();
    app.UseHospitalPipeline();
    app.MapControllers();
    app.MapPing(service);
    await app.MigrateAsync<LaboratoryDbContext>();
    await LabCatalogSeeder.SeedAsync(app.Services);
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
