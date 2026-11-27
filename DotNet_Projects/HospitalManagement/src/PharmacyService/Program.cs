using HMS.Contracts.Prescriptions;
using HMS.Pharmacy.Clients;
using HMS.Pharmacy.Data;
using HMS.Pharmacy.Services;
using HMS.Shared.Grpc;
using HMS.Shared.Hosting;
using HMS.Shared.Messaging;
using Serilog;

Log.Logger = new LoggerConfiguration().WriteTo.Console().CreateBootstrapLogger();
try
{
    var builder = WebApplication.CreateBuilder(args);
    const string service = "pharmacy-service";
    builder.AddHospitalCore(service);
    builder.ConfigureHospitalKestrel(28109);
    builder.AddHospitalPersistence<PharmacyDbContext>(builder.Configuration["Database:Name"]!);
    builder.AddHospitalMessaging<PharmacyDbContext>(service);
    // gRPC client -> Prescription Service (+ Polly "grpc" pipeline)
    builder.Services.AddGrpcResilience();
    builder.Services.AddTransient<GrpcHeadersInterceptor>();
    builder.Services.AddGrpcClient<PrescriptionGrpc.PrescriptionGrpcClient>(o => o.Address = new Uri(builder.Configuration["Services:PrescriptionGrpc"] ?? "http://localhost:28206"))
        .AddInterceptor<GrpcHeadersInterceptor>();
    builder.Services.AddScoped<IPrescriptionDirectory, PrescriptionDirectory>();
    builder.Services.AddScoped<IPharmacyAppService, PharmacyAppService>();
    builder.Services.AddScoped<IEventHandler, PrescriptionCreatedHandler>();
    builder.Services.AddHostedService<LowStockJob>();

    var app = builder.Build();
    app.UseHospitalPipeline();
    app.MapControllers();
    app.MapPing(service);
    await app.MigrateAsync<PharmacyDbContext>();
    await MedicineSeeder.SeedAsync(app.Services);
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
