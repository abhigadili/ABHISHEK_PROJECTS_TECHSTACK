using HMS.Shared.Common;
using HMS.Shared.Hosting;
using Microsoft.AspNetCore.Authorization;
using Serilog;
using Yarp.ReverseProxy.Forwarder;
using Yarp.ReverseProxy.Transforms;

Log.Logger = new LoggerConfiguration().WriteTo.Console().CreateBootstrapLogger();
try
{
    var builder = WebApplication.CreateBuilder(args);
    const string service = "api-gateway";
    builder.AddHospitalCore(service, controllers: false);
    builder.ConfigureHospitalKestrel(28080);

    // Edge authorization: JWT validated once here (and again by each service). Routes reference these policy names from configuration.
    builder.Services.AddAuthorizationBuilder()
        // "anonymous" (login/register routes) is a policy name reserved and provided by YARP itself
        .AddPolicy("authenticated", p => p.RequireAuthenticatedUser())
        .AddPolicy("admin", p => p.RequireRole(Roles.Admin))
        .AddPolicy("pharmacy", p => p.RequireRole(Roles.Admin, Roles.Pharmacist, Roles.Doctor))
        .AddPolicy("lab", p => p.RequireRole(Roles.Admin, Roles.Doctor, Roles.LabStaff, Roles.Patient))
        .AddPolicy("billing", p => p.RequireRole(Roles.Admin, Roles.BillingStaff, Roles.Patient));

    // Routes, clusters (destinations, load balancing, passive health checks) are configuration - see the "ReverseProxy" section of appsettings.json
    builder.Services.AddReverseProxy()
        .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"))
        .AddTransforms(ctx => ctx.AddRequestTransform(t =>
        {
            if (CorrelationContext.Id is { } id) t.ProxyRequest.Headers.TryAddWithoutValidation(CorrelationContext.HeaderName, id);
            return ValueTask.CompletedTask;
        }));

    var app = builder.Build();
    app.UseHospitalPipeline();

    app.MapReverseProxy(proxy =>
    {
        // gateway-level error handling: unreachable / slow downstream services become clean JSON 503 / 504
        proxy.Use(async (ctx, next) =>
        {
            await next();
            var err = ctx.GetForwarderErrorFeature();
            if (err is null) return;
            app.Logger.LogWarning("Forwarding {Method} {Path} failed: {Error}", ctx.Request.Method, ctx.Request.Path, err.Error);
            var timeout = err.Error is ForwarderError.RequestTimedOut;
            await ExceptionHandlingMiddleware.Write(ctx, timeout ? System.Net.HttpStatusCode.GatewayTimeout : System.Net.HttpStatusCode.ServiceUnavailable,
                timeout ? "The target service did not respond in time" : "The target service is currently unavailable");
        });
        proxy.UseSessionAffinity();
        proxy.UseLoadBalancing();
        proxy.UsePassiveHealthChecks();
    });

    // anything that is not a configured route (internal endpoints like /ping, /internal/**, unknown paths): never proxied
    app.MapFallback(ctx => ExceptionHandlingMiddleware.Write(ctx, System.Net.HttpStatusCode.NotFound, "No such route or endpoint")).RequireAuthorization();

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
