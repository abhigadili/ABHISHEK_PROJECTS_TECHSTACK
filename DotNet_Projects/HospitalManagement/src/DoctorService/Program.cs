using HMS.Doctors.Clients;
using HMS.Doctors.Data;
using HMS.Doctors.Services;
using HMS.Shared.Hosting;
using HMS.Shared.Http;
using Serilog;

Log.Logger = new LoggerConfiguration().WriteTo.Console().CreateBootstrapLogger();
try
{
    var builder = WebApplication.CreateBuilder(args);
    const string service = "doctor-service";
    builder.AddHospitalCore(service);
    builder.ConfigureHospitalKestrel(28102);
    builder.AddHospitalPersistence<DoctorDbContext>(builder.Configuration["Database:Name"]!);
    builder.AddHospitalCache(service);
    builder.Services.AddHospitalHttpClient<IHospitalDirectory, HospitalClient>("hospital-service", builder.Configuration["Services:Hospital"] ?? "http://localhost:28104");
    builder.Services.AddScoped<IDoctorAppService, DoctorAppService>();

    var app = builder.Build();
    app.UseHospitalPipeline();
    app.MapControllers();
    app.MapPing(service);
    await app.MigrateAsync<DoctorDbContext>();
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
