using Common;
using Common.Errors;
using Common.Security;
using Observability;
using Yarp.ReverseProxy.Forwarder;

var builder = WebApplication.CreateBuilder(args);
builder.AddSmsObservability("api-gateway");

// Centralised authentication: the gateway validates the JWT (same secret/issuer/audience as the services). Fine-grained role checks stay in
// each service (defence in depth); the original Authorization header is forwarded.
builder.Services.AddSmsJwtAuth(builder.Configuration);
builder.Services.AddAuthorizationBuilder()
    .AddPolicy("authenticated", p => p.RequireAuthenticatedUser())
    .AddPolicy("public", p => p.RequireAssertion(_ => true));
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddReverseProxy().LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"));
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p
    .WithOrigins((builder.Configuration["Cors:AllowedOrigins"] ?? "http://localhost:3000,http://localhost:4200,http://localhost:5173").Split(','))
    .AllowAnyHeader().AllowAnyMethod().WithExposedHeaders("X-Correlation-Id")));
builder.Services.AddHealthChecks();

var app = builder.Build();
app.UseMiddleware<Common.Web.CorrelationIdMiddleware>();
app.UseExceptionHandler(_ => { });
app.UseSmsObservability();
app.UseCors();
app.UseSwaggerUI(c =>
{
    c.RoutePrefix = "swagger";
    c.SwaggerEndpoint("/docs/student/swagger.json", "Student Service");
    c.SwaggerEndpoint("/docs/course/swagger.json", "Course Service");
    c.SwaggerEndpoint("/docs/enrollment/swagger.json", "Enrollment Service");
    c.SwaggerEndpoint("/docs/notification/swagger.json", "Notification Service");
    c.DocumentTitle = "Student Management - API Gateway";
});
app.UseAuthentication();
app.UseAuthorization();

app.MapHealthChecks("/health/live");
app.MapHealthChecks("/health/ready", new() { ResponseWriter = HealthWriter.Write });
app.MapHealthChecks("/health", new() { ResponseWriter = HealthWriter.Write });

/// Documents the gateway routes (route id → path, methods, cluster, auth policy).
app.MapGet("/gateway/routes", (Yarp.ReverseProxy.Configuration.IProxyConfigProvider p) =>
    p.GetConfig().Routes.OrderBy(r => r.Order).Select(r => new { r.RouteId, path = r.Match.Path, methods = r.Match.Methods, cluster = r.ClusterId, auth = r.AuthorizationPolicy ?? "default" }))
    .AllowAnonymous().WithTags("Gateway");

app.MapReverseProxy(proxy =>
{
    // Unavailable downstream service → clean 503 JSON instead of an empty 502/504 body
    proxy.Use(async (ctx, next) =>
    {
        await next();
        var err = ctx.Features.Get<IForwarderErrorFeature>();
        if (err != null && !ctx.Response.HasStarted)
        {
            ctx.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger("gateway").LogWarning("Downstream failure {Error} for {Path}", err.Error, ctx.Request.Path);
            var cluster = ctx.GetReverseProxyFeature().Cluster.Config.ClusterId;
            await ApiErrorWriter.Write(ctx, 503, "Service Unavailable", $"{cluster} is currently unavailable. Please retry shortly.");
        }
    });
    proxy.UsePassiveHealthChecks();
});
app.Run();

public partial class Program { }
