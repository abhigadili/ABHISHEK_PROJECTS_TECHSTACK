using HMS.Prescriptions.Data;
using HMS.Prescriptions.Grpc;
using HMS.Prescriptions.Services;
using HMS.Shared.Hosting;
using HMS.Shared.Messaging;
using Serilog;

Log.Logger = new LoggerConfiguration().WriteTo.Console().CreateBootstrapLogger();
try
{
    var builder = WebApplication.CreateBuilder(args);
    const string service = "prescription-service";
    builder.AddHospitalCore(service);
    builder.ConfigureHospitalKestrel(28106, 28206);
    builder.AddHospitalPersistence<PrescriptionDbContext>(builder.Configuration["Database:Name"]!);
    builder.AddHospitalMessaging<PrescriptionDbContext>(service);
    builder.AddPatientGrpcClient();      // gRPC -> Patient Service
    builder.AddDoctorHttpClient();       // HttpClient (+ Polly) -> Doctor Service
    builder.Services.AddGrpc();          // gRPC server for the Pharmacy Service
    builder.Services.AddScoped<IPrescriptionAppService, PrescriptionAppService>();
    builder.Services.AddScoped<IEventHandler, MedicineDispensedHandler>();
    builder.Services.AddHostedService<PrescriptionExpiryJob>();

    var app = builder.Build();
    app.UseHospitalPipeline();
    app.MapControllers();
    app.MapGrpcService<PrescriptionGrpcService>();
    app.MapPing(service);
    await app.MigrateAsync<PrescriptionDbContext>();
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
