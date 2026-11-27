using Microsoft.AspNetCore.Http;
using Common.Caching;
using Common.Errors;
using Common.Web;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.OpenApi.Models;
using StackExchange.Redis;

namespace Common;

public static class ServiceCollectionExtensions
{
    /// <summary>Exception handler + ProblemDetails off + Swagger with the JWT "Authorize" button.</summary>
    public static IServiceCollection AddSmsWebDefaults(this IServiceCollection services, string title, string description)
    {
        services.AddExceptionHandler<GlobalExceptionHandler>();
        services.AddHttpContextAccessor();
        services.AddEndpointsApiExplorer();
        services.AddSwaggerGen(o =>
        {
            o.SwaggerDoc("v1", new OpenApiInfo { Title = title, Version = "v1", Description = description + " All calls go through the API Gateway (:8080)." });
            o.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
            { Name = "Authorization", Type = SecuritySchemeType.Http, Scheme = "bearer", BearerFormat = "JWT", In = ParameterLocation.Header, Description = "Paste the access token (without 'Bearer ')." });
            o.AddSecurityRequirement(new OpenApiSecurityRequirement
            {
                [new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" } }] = Array.Empty<string>()
            });
            var xml = Path.Combine(AppContext.BaseDirectory, $"{System.Reflection.Assembly.GetEntryAssembly()!.GetName().Name}.xml");
            if (File.Exists(xml)) o.IncludeXmlComments(xml);
        });
        return services;
    }

    /// <summary>Redis-backed IDistributedCache + ICacheService. Instance name prefixes every key ("sms:").</summary>
    public static IServiceCollection AddSmsRedis(this IServiceCollection services, IConfiguration config)
    {
        var conn = config.GetConnectionString("Redis") ?? "localhost:6379";
        services.AddStackExchangeRedisCache(o =>
        {
            o.Configuration = conn + ",abortConnect=false,connectTimeout=1000,syncTimeout=1000";
            o.InstanceName = "sms:";
        });
        services.AddSingleton<ICacheService, RedisCacheService>();
        services.AddSingleton<IConnectionMultiplexer>(_ => ConnectionMultiplexer.Connect(conn + ",abortConnect=false,connectTimeout=1000"));
        services.AddHealthChecks().AddCheck<RedisHealthCheck>("redis", tags: new[] { "ready" });
        return services;
    }

    public static IApplicationBuilder UseSmsWebDefaults(this WebApplication app)
    {
        app.UseMiddleware<CorrelationIdMiddleware>();
        app.UseExceptionHandler(_ => { });
        app.UseSwagger();
        app.UseSwaggerUI();
        return app;
    }

    /// <summary>/health/live (process only) and /health/ready (dependencies tagged "ready"); /health = ready.</summary>
    public static void MapSmsHealth(this WebApplication app)
    {
        app.MapHealthChecks("/health/live", new() { Predicate = _ => false });
        app.MapHealthChecks("/health/ready", new() { Predicate = r => r.Tags.Contains("ready"), ResponseWriter = HealthWriter.Write });
        app.MapHealthChecks("/health", new() { Predicate = r => r.Tags.Contains("ready"), ResponseWriter = HealthWriter.Write });
    }
}

public class RedisHealthCheck(IConnectionMultiplexer mux) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken ct = default)
    {
        try { var t = await mux.GetDatabase().PingAsync(); return HealthCheckResult.Healthy($"ping {t.TotalMilliseconds:0} ms"); }
        catch (Exception e) { return HealthCheckResult.Unhealthy("Redis unreachable", e); }
    }
}

public static class HealthWriter
{
    public static Task Write(HttpContext ctx, HealthReport r)
    {
        ctx.Response.ContentType = "application/json";
        var body = new
        {
            status = r.Status.ToString(),
            checks = r.Entries.ToDictionary(e => e.Key, e => new { status = e.Value.Status.ToString(), detail = e.Value.Description ?? e.Value.Exception?.Message })
        };
        return ctx.Response.WriteAsync(System.Text.Json.JsonSerializer.Serialize(body));
    }
}

public static class ControllersExtensions
{
    /// <summary>Controllers with enums as strings and model-validation failures returned as the common ApiError body (400 + fieldErrors).</summary>
    public static IMvcBuilder AddSmsControllers(this IServiceCollection services)
        => services.AddControllers()
            .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter()))
            .ConfigureApiBehaviorOptions(o => o.InvalidModelStateResponseFactory = ctx =>
            {
                var fields = ctx.ModelState.Where(e => e.Value?.Errors.Count > 0)
                    .ToDictionary(e => char.ToLowerInvariant(e.Key[0]) + e.Key[1..], e => e.Value!.Errors.Select(x => string.IsNullOrEmpty(x.ErrorMessage) ? "invalid value" : x.ErrorMessage).ToArray());
                var body = new Errors.ApiError(DateTimeOffset.UtcNow, 400, "Bad Request", "Validation failed", ctx.HttpContext.Request.Path, fields,
                    ctx.HttpContext.Response.Headers["X-Correlation-Id"].FirstOrDefault());
                return new Microsoft.AspNetCore.Mvc.BadRequestObjectResult(body);
            });
}
