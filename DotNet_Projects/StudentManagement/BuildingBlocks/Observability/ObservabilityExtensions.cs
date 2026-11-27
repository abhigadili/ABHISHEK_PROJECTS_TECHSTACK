using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using Serilog;
using Serilog.Events;

namespace Observability;

public static class ObservabilityExtensions
{
    /// <summary>Serilog (console, request/trace/correlation ids in every line) + OpenTelemetry tracing (OTLP) and metrics (Prometheus /metrics).</summary>
    public static WebApplicationBuilder AddSmsObservability(this WebApplicationBuilder builder, string serviceName, params string[] extraSources)
    {
        builder.Host.UseSerilog((ctx, cfg) => cfg
            .MinimumLevel.Information()
            .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
            .MinimumLevel.Override("Microsoft.Hosting.Lifetime", LogEventLevel.Information)
            .MinimumLevel.Override("System.Net.Http", LogEventLevel.Warning)
            .Enrich.FromLogContext()
            .Enrich.WithProperty("Service", serviceName)
            .WriteTo.Console(outputTemplate:
                "{Timestamp:HH:mm:ss.fff} {Level:u3} [{Service},{TraceId},{CorrelationId}] {SourceContext}: {Message:lj}{NewLine}{Exception}"));

        var otlp = builder.Configuration["OpenTelemetry:OtlpEndpoint"];
        builder.Services.AddOpenTelemetry()
            .ConfigureResource(r => r.AddService(serviceName))
            .WithTracing(t =>
            {
                t.AddAspNetCoreInstrumentation(o => o.Filter = c => !c.Request.Path.StartsWithSegments("/health") && !c.Request.Path.StartsWithSegments("/metrics"))
                 .AddHttpClientInstrumentation();
                foreach (var s in extraSources) t.AddSource(s);
                if (!string.IsNullOrWhiteSpace(otlp)) t.AddOtlpExporter(o => o.Endpoint = new Uri(otlp));
            })
            .WithMetrics(m => m
                .AddAspNetCoreInstrumentation().AddHttpClientInstrumentation().AddRuntimeInstrumentation()
                .AddMeter(extraSources.Concat(new[] { serviceName }).ToArray())
                .AddPrometheusExporter());
        return builder;
    }

    /// <summary>Serilog request logging + Prometheus scrape endpoint (GET /metrics).</summary>
    public static WebApplication UseSmsObservability(this WebApplication app)
    {
        app.UseSerilogRequestLogging(o =>
        {
            o.GetLevel = (ctx, _, ex) => ex != null || ctx.Response.StatusCode >= 500 ? LogEventLevel.Error
                : ctx.Request.Path.StartsWithSegments("/health") || ctx.Request.Path.StartsWithSegments("/metrics") ? LogEventLevel.Verbose : LogEventLevel.Information;
            o.MessageTemplate = "HTTP {RequestMethod} {RequestPath} -> {StatusCode} ({Elapsed:0} ms)";
        });
        app.UseOpenTelemetryPrometheusScrapingEndpoint();
        return app;
    }
}
