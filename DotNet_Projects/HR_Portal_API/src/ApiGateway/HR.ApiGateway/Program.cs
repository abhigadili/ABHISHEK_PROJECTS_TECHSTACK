using System.Text.Json;
using HR.ApiGateway.Dashboard;
using HR.Common.Cache;
using HR.Common.Common;
using HR.Common.Hosting;
using HR.Common.Http;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Serilog;
using Serilog.Events;
using Yarp.ReverseProxy.Configuration;

var builder = WebApplication.CreateBuilder(args);
var cfg = builder.Configuration;
cfg["Service:Name"] = "HR.ApiGateway";
const string template = "{Timestamp:yyyy-MM-dd HH:mm:ss.fff} {Level:u5} [{Application}] [{CorrelationId}] {SourceContext} - {Message:lj}{NewLine}{Exception}";
builder.Host.UseSerilog((ctx, lc) => lc.MinimumLevel.Information().MinimumLevel.Override("Microsoft", LogEventLevel.Warning).MinimumLevel.Override("Yarp", LogEventLevel.Warning)
    .Enrich.FromLogContext().Enrich.WithProperty("Application", "HR.ApiGateway")
    .WriteTo.Console(outputTemplate: template).WriteTo.File(Path.Combine(cfg["LOG_DIR"] ?? "logs", "HR.ApiGateway-.log"), rollingInterval: RollingInterval.Day, retainedFileCountLimit: 7, outputTemplate: template));
builder.WebHost.ConfigureKestrel(k => k.ListenAnyIP(cfg.GetValue("Ports:Http", 32080)));

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<HR.Common.Security.ICurrentUser, HR.Common.Security.CurrentUser>();
HrHosting.AddRedis(builder.Services, cfg, "HR.ApiGateway");
builder.Services.AddJwt(cfg);
builder.Services.AddAuthorization();
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.WithOrigins((cfg["CORS_ORIGINS"] ?? "http://localhost:3000").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
    .AllowAnyHeader().AllowAnyMethod().WithExposedHeaders(CorrelationContext.HeaderName)));
builder.Services.AddControllers().AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter()));

// service base URLs come from configuration/environment (Services:<Name>), also used to re-point the YARP clusters (docker vs local)
builder.Services.AddReverseProxy().LoadFromConfig(cfg.GetSection("ReverseProxy")).AddConfigFilter<EnvironmentDestinationFilter>();
builder.Services.AddDashboardClients(cfg);
builder.Services.AddScoped<IDashboardService, DashboardService>();

var app = builder.Build();
app.UseMiddleware<CorrelationIdMiddleware>();
app.UseMiddleware<SecurityHeadersMiddleware>();
app.UseMiddleware<RequestLoggingMiddleware>();
app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.UseMiddleware<GatewayAuthorizationMiddleware>();   // gateway-level authorization: everything except the public allowlist needs a valid JWT
app.UseMiddleware<RedisRateLimitMiddleware>();
app.Map("/ping", b => b.Run(ctx => ctx.Response.WriteAsJsonAsync(new { service = "HR.ApiGateway", status = "UP" })));
app.MapControllers();
app.MapReverseProxy();
app.Run();

/// <summary>Replaces cluster destination addresses with Services:&lt;Cluster&gt; when configured (environment overrides, e.g. Services__Auth).</summary>
public sealed class EnvironmentDestinationFilter(IConfiguration cfg) : IProxyConfigFilter
{
    public ValueTask<ClusterConfig> ConfigureClusterAsync(ClusterConfig cluster, CancellationToken ct)
    {
        var url = cfg[$"Services:{char.ToUpperInvariant(cluster.ClusterId[0])}{cluster.ClusterId[1..]}"];
        if (string.IsNullOrWhiteSpace(url) || cluster.Destinations is null) return new(cluster);
        var dests = cluster.Destinations.ToDictionary(d => d.Key, d => d.Value with { Address = url.TrimEnd('/') + "/" });
        return new(cluster with { Destinations = dests });
    }

    public ValueTask<RouteConfig> ConfigureRouteAsync(RouteConfig route, ClusterConfig? cluster, CancellationToken ct) => new(route);
}

public sealed class GatewayAuthorizationMiddleware(RequestDelegate next, IConfiguration cfg)
{
    private readonly HashSet<string> _public = cfg.GetSection("Gateway:PublicPaths").Get<string[]>()?.ToHashSet(StringComparer.OrdinalIgnoreCase) ?? [];

    public async Task InvokeAsync(HttpContext ctx)
    {
        var path = ctx.Request.Path.Value?.TrimEnd('/') ?? "";
        var guarded = path.StartsWith("/api/", StringComparison.OrdinalIgnoreCase) && !_public.Contains(path) && !HttpMethods.IsOptions(ctx.Request.Method);
        if (guarded && ctx.User.Identity?.IsAuthenticated != true)
        {
            await ExceptionHandlingMiddleware.Write(ctx, System.Net.HttpStatusCode.Unauthorized, "UNAUTHORIZED", "Authentication required: missing, invalid, expired or revoked token");
            return;
        }
        await next(ctx);
    }
}

/// <summary>Redis fixed-window rate limit: per user (JWT sub) when authenticated, otherwise per client IP. Fails open if Redis is down.</summary>
public sealed class RedisRateLimitMiddleware(RequestDelegate next, IRedisService redis, IConfiguration cfg)
{
    private readonly int _limit = cfg.GetValue("Gateway:RateLimitPerMinute", 240);

    public async Task InvokeAsync(HttpContext ctx)
    {
        if (ctx.Request.Path.StartsWithSegments("/api"))
        {
            var who = ctx.User.FindFirst("sub")?.Value ?? ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown";
            var window = DateTimeOffset.UtcNow.ToUnixTimeSeconds() / 60;
            var n = await redis.IncrementWindowAsync($"ratelimit:gw:{who}:{window}", TimeSpan.FromSeconds(70));
            ctx.Response.Headers["X-RateLimit-Limit"] = _limit.ToString();
            ctx.Response.Headers["X-RateLimit-Remaining"] = Math.Max(0, _limit - n).ToString();
            if (n > _limit)
            {
                ctx.Response.Headers["Retry-After"] = (60 - DateTimeOffset.UtcNow.Second).ToString();
                await ExceptionHandlingMiddleware.Write(ctx, System.Net.HttpStatusCode.TooManyRequests, "RATE_LIMITED", "Too many requests, please retry shortly");
                return;
            }
        }
        await next(ctx);
    }
}
