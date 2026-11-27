using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Serilog;
using Serilog.Events;

namespace StudentMgmt.BuildingBlocks.Common.Extensions;

public static class SerilogHostExtensions
{
    /// <summary>
    /// Configures Serilog with console + rolling-file sinks, structured logging,
    /// and machine/environment enrichment. Called from Program.cs via
    /// <c>builder.Host.UseAppSerilog(serviceName)</c> before the app is built, so
    /// even startup failures are logged.
    /// </summary>
    public static IHostBuilder UseAppSerilog(this IHostBuilder hostBuilder, string serviceName)
    {
        return hostBuilder.UseSerilog((context, services, loggerConfiguration) =>
        {
            loggerConfiguration
                .MinimumLevel.Information()
                .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
                .MinimumLevel.Override("Microsoft.EntityFrameworkCore", LogEventLevel.Warning)
                .Enrich.FromLogContext()
                .Enrich.WithMachineName()
                .Enrich.WithEnvironmentName()
                .Enrich.WithProperty("Service", serviceName)
                .WriteTo.Console(outputTemplate:
                    "[{Timestamp:HH:mm:ss} {Level:u3}] [{Service}] [{CorrelationId}] {Message:lj}{NewLine}{Exception}")
                .WriteTo.File(
                    path: $"logs/{serviceName}-.log",
                    rollingInterval: RollingInterval.Day,
                    retainedFileCountLimit: 14,
                    outputTemplate:
                    "{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz} [{Level:u3}] [{Service}] [{CorrelationId}] {Message:lj}{NewLine}{Exception}")
                .ReadFrom.Configuration(context.Configuration);
        });
    }
}
