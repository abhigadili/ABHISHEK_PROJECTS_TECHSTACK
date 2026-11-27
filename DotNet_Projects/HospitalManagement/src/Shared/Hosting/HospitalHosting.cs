using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using HMS.Shared.Cache;
using HMS.Shared.Common;
using HMS.Shared.Data;
using HMS.Shared.Grpc;
using HMS.Shared.Http;
using HMS.Shared.Messaging;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using Serilog.Events;

namespace HMS.Shared.Hosting;

public static class HospitalHosting
{
    /// <summary>Serilog + controllers/validation + JWT validation + current-user - what every API (and the gateway) needs.</summary>
    public static WebApplicationBuilder AddHospitalCore(this WebApplicationBuilder builder, string serviceName, bool controllers = true)
    {
        var logDir = builder.Configuration["LOG_DIR"] ?? "logs";
        builder.Host.UseSerilog((ctx, lc) => lc
            .ReadFrom.Configuration(ctx.Configuration)
            .MinimumLevel.Information()
            .MinimumLevel.Override("Microsoft.AspNetCore", LogEventLevel.Warning)
            .MinimumLevel.Override("Microsoft.EntityFrameworkCore", LogEventLevel.Warning)
            .MinimumLevel.Override("Microsoft.Extensions.Http", LogEventLevel.Warning)
            .MinimumLevel.Override("Yarp", LogEventLevel.Warning)
            .MinimumLevel.Override("System", LogEventLevel.Warning)
            .Enrich.FromLogContext()
            .Enrich.WithProperty("Application", serviceName)
            .WriteTo.Console(outputTemplate: "{Timestamp:yyyy-MM-dd HH:mm:ss.fff} {Level:u5} [{Application}] [{CorrelationId}] {SourceContext} - {Message:lj}{NewLine}{Exception}")
            .WriteTo.File(Path.Combine(logDir, serviceName + "-.log"), rollingInterval: RollingInterval.Day, retainedFileCountLimit: 7, fileSizeLimitBytes: 20_000_000, rollOnFileSizeLimit: true,
                outputTemplate: "{Timestamp:yyyy-MM-dd HH:mm:ss.fff} {Level:u5} [{Application}] [{CorrelationId}] {SourceContext} - {Message:lj}{NewLine}{Exception}"));

        var s = builder.Services;
        s.AddHttpContextAccessor();
        s.AddScoped<ICurrentUser, CurrentUser>();
        if (controllers)
        {
            s.AddControllers().AddJsonOptions(o =>
            {
                o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
                o.JsonSerializerOptions.Converters.Add(new FlexibleTimeOnlyConverter());
                o.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
            }).ConfigureApiBehaviorOptions(o => o.InvalidModelStateResponseFactory = ctx =>
            {
                var details = ctx.ModelState.Where(kv => kv.Value?.Errors.Count > 0)
                    .SelectMany(kv => kv.Value!.Errors.Select(e => $"{char.ToLowerInvariant(kv.Key[0])}{kv.Key[1..]}: {(string.IsNullOrEmpty(e.ErrorMessage) ? "invalid value" : e.ErrorMessage)}")).ToList();
                var body = new ApiError(DateTimeOffset.UtcNow, 400, "Bad Request", "Validation failed", ctx.HttpContext.Request.Path, details);
                return new ObjectResult(body) { StatusCode = 400 };
            });
        }
        s.AddHospitalJwt(builder.Configuration);
        s.AddAuthorization();
        return builder;
    }

    public static IServiceCollection AddHospitalJwt(this IServiceCollection services, IConfiguration cfg)
    {
        var key = cfg["Jwt:Key"] ?? throw new InvalidOperationException("Jwt:Key missing");
        if (Encoding.UTF8.GetByteCount(key) < 32) throw new InvalidOperationException("Jwt:Key must be at least 32 bytes");
        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(o =>
        {
            o.MapInboundClaims = false;
            o.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true, ValidIssuer = cfg["Jwt:Issuer"] ?? "hospital-identity",
                ValidateAudience = true, ValidAudience = cfg["Jwt:Audience"] ?? "hospital-api",
                ValidateLifetime = true, RequireExpirationTime = true,
                ValidateIssuerSigningKey = true, IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),
                ClockSkew = TimeSpan.FromSeconds(30),
                NameClaimType = "unique_name", RoleClaimType = "role"
            };
            o.Events = new JwtBearerEvents
            {
                OnChallenge = ctx =>
                {
                    ctx.HandleResponse();
                    return ExceptionHandlingMiddleware.Write(ctx.HttpContext, System.Net.HttpStatusCode.Unauthorized, "Authentication required: missing, invalid or expired token");
                },
                OnForbidden = ctx => ExceptionHandlingMiddleware.Write(ctx.HttpContext, System.Net.HttpStatusCode.Forbidden, "You do not have permission to perform this action")
            };
        });
        return services;
    }

    public static WebApplicationBuilder AddHospitalPersistence<TContext>(this WebApplicationBuilder builder, string database) where TContext : DbContext
    {
        var cs = DbConnection.Build(builder.Configuration, database);
        builder.Services.AddDbContext<TContext>(o => DbConnection.Configure(o, cs));
        builder.Services.AddScoped<DbContext>(sp => sp.GetRequiredService<TContext>());
        builder.Services.AddScoped(typeof(IRepository<>), typeof(EfRepository<>));
        return builder;
    }

    /// <summary>Outbox relay (producer), consumer hosted service, topic initializer and the publisher abstraction.</summary>
    public static WebApplicationBuilder AddHospitalMessaging<TContext>(this WebApplicationBuilder builder, string consumerGroup) where TContext : ServiceDbContext
    {
        builder.Services.Configure<KafkaOptions>(o =>
        {
            builder.Configuration.GetSection("Kafka").Bind(o);
            o.GroupId = consumerGroup;
        });
        builder.Services.AddScoped<ServiceDbContext>(sp => sp.GetRequiredService<TContext>());
        builder.Services.AddScoped<IEventPublisher, EventPublisher>();
        builder.Services.AddHostedService<KafkaTopicInitializer>();
        builder.Services.AddHostedService<OutboxRelayService>();
        builder.Services.AddHostedService<KafkaConsumerService>();
        return builder;
    }

    public static WebApplicationBuilder AddHospitalCache(this WebApplicationBuilder builder, string serviceName)
    {
        var conn = builder.Configuration["REDIS_CONNECTION"] ?? builder.Configuration["Redis:ConnectionString"] ?? "localhost:26379";
        builder.Services.AddStackExchangeRedisCache(o =>
        {
            o.Configuration = conn + ",abortConnect=false,connectTimeout=1000,syncTimeout=1000,asyncTimeout=1000";
            o.InstanceName = $"hospital:{serviceName}:";
        });
        builder.Services.AddSingleton<ICacheService, RedisCacheService>();
        return builder;
    }

    public static WebApplicationBuilder AddPatientGrpcClient(this WebApplicationBuilder builder)
    {
        builder.Services.AddGrpcResilience();
        builder.Services.AddTransient<GrpcHeadersInterceptor>();
        builder.Services.AddGrpcClient<HMS.Contracts.Patients.PatientGrpc.PatientGrpcClient>(o => o.Address = new Uri(builder.Configuration["Services:PatientGrpc"] ?? "http://localhost:28201"))
            .AddInterceptor<GrpcHeadersInterceptor>();
        builder.Services.AddScoped<IPatientDirectory, PatientDirectory>();
        return builder;
    }

    public static WebApplicationBuilder AddDoctorHttpClient(this WebApplicationBuilder builder)
    {
        builder.Services.AddHospitalHttpClient<IDoctorDirectory, DoctorClient>("doctor-service", builder.Configuration["Services:Doctor"] ?? "http://localhost:28102");
        return builder;
    }

    /// <summary>REST on Http1 (Ports:Http); optional gRPC on a separate cleartext HTTP/2 port (Ports:Grpc).</summary>
    public static WebApplicationBuilder ConfigureHospitalKestrel(this WebApplicationBuilder builder, int defaultHttp, int? defaultGrpc = null)
    {
        var http = builder.Configuration.GetValue("Ports:Http", defaultHttp);
        var grpc = builder.Configuration.GetValue<int?>("Ports:Grpc") ?? defaultGrpc;
        builder.WebHost.ConfigureKestrel(k =>
        {
            k.ListenAnyIP(http, o => o.Protocols = HttpProtocols.Http1);
            if (grpc is not null) k.ListenAnyIP(grpc.Value, o => o.Protocols = HttpProtocols.Http2);
        });
        return builder;
    }

    public static WebApplication UseHospitalPipeline(this WebApplication app)
    {
        app.UseMiddleware<CorrelationIdMiddleware>();
        app.UseSerilogRequestLogging(o => o.GetLevel = (ctx, _, ex) => ex != null || ctx.Response.StatusCode >= 500 ? LogEventLevel.Error : ctx.Response.StatusCode >= 400 ? LogEventLevel.Warning : LogEventLevel.Information);
        app.UseMiddleware<ExceptionHandlingMiddleware>();
        app.UseAuthentication();
        app.UseAuthorization();
        return app;
    }

    /// <summary>Applies EF Core migrations (retrying while MySQL is still starting). Only this service's own tables are created.</summary>
    public static async Task MigrateAsync<TContext>(this WebApplication app) where TContext : DbContext
    {
        var log = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("Migrations");
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                using var scope = app.Services.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<TContext>();
                await db.Database.MigrateAsync();
                log.LogInformation("Database migrations applied for {Context}", typeof(TContext).Name);
                return;
            }
            catch (Exception ex) when (attempt < 10)
            {
                log.LogWarning("Migration attempt {Attempt} failed: {Error}", attempt, ex.Message);
                await Task.Delay(2000);
            }
        }
    }

    /// <summary>Minimal unauthenticated liveness probe (not routed by the gateway).</summary>
    public static WebApplication MapPing(this WebApplication app, string service)
    {
        app.MapGet("/ping", () => Results.Json(new { service, status = "UP" })).AllowAnonymous();
        return app;
    }
}
