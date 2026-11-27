using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.AspNetCore.Hosting;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Asp.Versioning;
using FluentValidation;
using HR.Common.Cache;
using HR.Common.Common;
using HR.Common.Data;
using HR.Common.Messaging;
using HR.Common.Security;
using HR.Common.Util;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using MySqlConnector;
using Serilog;
using Serilog.Events;
using StackExchange.Redis;

namespace HR.Common.Hosting;

public static class HrHosting
{
    /// <summary>
    /// One call wires everything a service needs: Serilog, MVC (global filters), versioning, Swagger, JWT + revocation, permission policies,
    /// Redis, EF Core + ADO.NET on the existing database, repositories, unit of work, audit, outbox publisher and (optionally) Kafka consumers.
    /// </summary>
    public static WebApplicationBuilder AddHrService<TContext>(this WebApplicationBuilder builder, string name, string database, int defaultPort, bool kafka = true) where TContext : HrDbContext
    {
        var cfg = builder.Configuration;
        cfg["Service:Name"] = name;
        Mapster.TypeAdapterConfig.GlobalSettings.Default.Settings.IgnoreNullValues = true;   // request DTO -> entity maps only supplied values (PATCH-style merge)
        var s = builder.Services;

        // ---- logging (Serilog; secrets are never logged: no bodies, no tokens)
        var logDir = cfg["LOG_DIR"] ?? "logs";
        const string template = "{Timestamp:yyyy-MM-dd HH:mm:ss.fff} {Level:u5} [{Application}] [{CorrelationId}] {SourceContext} - {Message:lj}{NewLine}{Exception}";
        builder.Host.UseSerilog((ctx, lc) => lc
            .MinimumLevel.Information()
            .MinimumLevel.Override("Microsoft", LogEventLevel.Warning).MinimumLevel.Override("System", LogEventLevel.Warning)
            .MinimumLevel.Override("Yarp", LogEventLevel.Warning)
            .Enrich.FromLogContext().Enrich.WithProperty("Application", name)
            .WriteTo.Console(outputTemplate: template)
            .WriteTo.File(Path.Combine(logDir, name + "-.log"), rollingInterval: RollingInterval.Day, retainedFileCountLimit: 7, outputTemplate: template));

        // ---- web / kestrel
        var port = cfg.GetValue("Ports:Http", defaultPort);
        builder.WebHost.ConfigureKestrel(k => k.ListenAnyIP(port));
        s.AddHttpContextAccessor();
        s.AddScoped<ICurrentUser, CurrentUser>();
        s.AddScoped<ICurrentUserAccessor, CurrentUserAccessor>();
        s.AddScoped<AuditingInterceptor>();

        s.AddControllers(o =>
        {
            o.Filters.Add<FluentValidationFilter>();            // global action filter (DI-injected)
            o.Filters.Add<ApiResponseFilter>();                 // global result filter
            o.Filters.Add<BusinessExceptionLoggingFilter>();    // global exception filter
        }).AddJsonOptions(o =>
        {
            o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
            o.JsonSerializerOptions.Converters.Add(new FlexibleTimeOnlyConverter());
            o.JsonSerializerOptions.Converters.Add(new UtcDateTimeJsonConverter());
            o.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
        }).ConfigureApiBehaviorOptions(o => o.InvalidModelStateResponseFactory = ctx =>
        {
            var details = ctx.ModelState.Where(kv => kv.Value?.Errors.Count > 0)
                .SelectMany(kv => kv.Value!.Errors.Select(e => $"{(kv.Key.Length > 0 ? char.ToLowerInvariant(kv.Key[0]) + kv.Key[1..] : "body")}: {(string.IsNullOrEmpty(e.ErrorMessage) ? "invalid value" : e.ErrorMessage)}")).ToList();
            return new ObjectResult(new ApiErrorResponse(false, 400, new ApiErrorBody("VALIDATION_FAILED", "Validation failed", details), ctx.HttpContext.Request.Path, CorrelationContext.Id, DateTimeOffset.UtcNow)) { StatusCode = 400 };
        });
        s.AddApiVersioning(o => { o.DefaultApiVersion = new ApiVersion(1, 0); o.AssumeDefaultVersionWhenUnspecified = true; o.ReportApiVersions = true; })
            .AddMvc().AddApiExplorer(o => { o.GroupNameFormat = "'v'VVV"; o.SubstituteApiVersionInUrl = true; });
        s.AddEndpointsApiExplorer();
        s.AddSwaggerGen(o =>
        {
            o.SwaggerDoc("v1", new() { Title = name, Version = "v1" });
            o.AddSecurityDefinition("Bearer", new() { Name = "Authorization", Type = Microsoft.OpenApi.Models.SecuritySchemeType.Http, Scheme = "bearer", BearerFormat = "JWT", In = Microsoft.OpenApi.Models.ParameterLocation.Header });
            o.AddSecurityRequirement(new() { { new() { Reference = new() { Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme, Id = "Bearer" } }, [] } });
            o.CustomSchemaIds(t => t.FullName?.Replace('+', '.'));
        });
        s.AddCors(o => o.AddDefaultPolicy(p => p.WithOrigins((cfg["CORS_ORIGINS"] ?? "http://localhost:3000").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            .AllowAnyHeader().AllowAnyMethod().WithExposedHeaders(CorrelationContext.HeaderName)));

        // ---- redis
        AddRedis(s, cfg, name);

        // ---- security
        AddJwt(s, cfg);
        s.AddSingleton<IAuthorizationPolicyProvider, PermissionPolicyProvider>();
        s.AddSingleton<IAuthorizationHandler, PermissionAuthorizationHandler>();
        s.AddAuthorization();
        s.AddSingleton<IFieldCrypto, FieldCrypto>();
        s.AddSingleton<HR.Common.Storage.IFileStorage, HR.Common.Storage.LocalFileStorage>();

        // ---- persistence: EF Core (primary ORM) + ADO.NET data source on the same pooled connection string
        var cs = DbConnection.Build(cfg, database);
        s.AddDbContext<TContext>((sp, o) => { DbConnection.Configure(o, cs); o.AddInterceptors(sp.GetRequiredService<AuditingInterceptor>()); });
        s.AddScoped<HrDbContext>(sp => sp.GetRequiredService<TContext>());
        s.AddScoped<DbContext>(sp => sp.GetRequiredService<TContext>());
        s.AddScoped(typeof(IRepository<>), typeof(EfRepository<>));
        s.AddScoped<IUnitOfWork, UnitOfWork>();
        s.AddScoped<IAuditWriter, AuditWriter>();
        s.AddSingleton(new MySqlDataSourceBuilder(cs).Build());
        s.AddSingleton<IAdoNet, AdoNet>();
        s.AddValidatorsFromAssembly(typeof(TContext).Assembly);

        // ---- messaging (transactional outbox publisher; consumer + relay as BackgroundServices)
        s.Configure<KafkaOptions>(o =>
        {
            o.BootstrapServers = cfg["KAFKA_BOOTSTRAP"] ?? cfg["Kafka:BootstrapServers"] ?? "localhost:9492";
            o.GroupId = "hr-dn-" + name.Replace("HR.", "").Replace("Service", "").ToLowerInvariant();
        });
        s.AddScoped<IEventPublisher, EventPublisher>();
        if (kafka)
        {
            s.AddHostedService<KafkaTopicInitializer>();
            s.AddHostedService<OutboxRelayService>();
            s.AddHostedService<KafkaConsumerService>();
        }
        return builder;
    }

    public static IServiceCollection AddEventHandler<THandler>(this IServiceCollection services) where THandler : class, IEventHandler => services.AddScoped<IEventHandler, THandler>();

    public static void AddRedis(IServiceCollection s, IConfiguration cfg, string name)
    {
        var conn = cfg["REDIS_CONNECTION"] ?? "localhost:9579";
        var opts = ConfigurationOptions.Parse(conn);
        opts.AbortOnConnectFail = false; opts.ConnectTimeout = 2000; opts.SyncTimeout = 2000; opts.AsyncTimeout = 2000; opts.ConnectRetry = 3;
        s.AddSingleton<IConnectionMultiplexer>(_ => ConnectionMultiplexer.Connect(opts));
        s.AddStackExchangeRedisCache(o => { o.ConfigurationOptions = opts; o.InstanceName = $"hr:{name}:"; });
        s.AddSingleton<IRedisService, RedisService>();
        s.AddSingleton<ICacheService, RedisCacheService>();
        s.AddSingleton<TokenRevocationStore>();
    }

    public static IServiceCollection AddJwt(this IServiceCollection services, IConfiguration cfg)
    {
        var key = cfg["JWT_KEY"] ?? throw new InvalidOperationException("JWT_KEY is not set");
        if (Encoding.UTF8.GetByteCount(key) < 32) throw new InvalidOperationException("JWT_KEY must be at least 32 bytes");
        services.Configure<JwtOptions>(o =>
        {
            o.Key = key;
            o.Issuer = cfg["Jwt:Issuer"] ?? "hr-portal-dotnet";
            o.Audience = cfg["Jwt:Audience"] ?? "hr-portal-api";
            o.AccessTtlSeconds = cfg.GetValue("Jwt:AccessTtlSeconds", 900);
            o.RefreshTtlSeconds = cfg.GetValue("Jwt:RefreshTtlSeconds", 604800);
        });
        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(o =>
        {
            o.MapInboundClaims = false;
            o.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true, ValidIssuer = cfg["Jwt:Issuer"] ?? "hr-portal-dotnet",
                ValidateAudience = true, ValidAudience = cfg["Jwt:Audience"] ?? "hr-portal-api",
                ValidateLifetime = true, RequireExpirationTime = true, ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)), ClockSkew = TimeSpan.FromSeconds(30),
                NameClaimType = "unique_name", RoleClaimType = "role"
            };
            o.Events = new JwtBearerEvents
            {
                OnTokenValidated = async ctx =>
                {
                    var store = ctx.HttpContext.RequestServices.GetRequiredService<TokenRevocationStore>();
                    var jti = ctx.Principal?.FindFirst("jti")?.Value;
                    var sub = ctx.Principal?.FindFirst("sub")?.Value;
                    _ = long.TryParse(ctx.Principal?.FindFirst("iat")?.Value, out var iat);
                    if (await store.IsRevokedAsync(jti, sub, iat)) ctx.Fail("Token has been revoked");
                },
                OnChallenge = ctx =>
                {
                    ctx.HandleResponse();
                    return ExceptionHandlingMiddleware.Write(ctx.HttpContext, System.Net.HttpStatusCode.Unauthorized, "UNAUTHORIZED", "Authentication required: missing, invalid, expired or revoked token");
                },
                OnForbidden = ctx => ExceptionHandlingMiddleware.Write(ctx.HttpContext, System.Net.HttpStatusCode.Forbidden, "FORBIDDEN", "You do not have permission to perform this action")
            };
        });
        return services;
    }

    /// <summary>The request pipeline (order matters): correlation -> security headers -> logging -> exception handling -> header validation (UseWhen /api) -> CORS -> authN -> authZ.</summary>
    public static WebApplication UseHrPipeline(this WebApplication app)
    {
        app.UseMiddleware<CorrelationIdMiddleware>();
        app.UseMiddleware<SecurityHeadersMiddleware>();
        app.UseMiddleware<RequestLoggingMiddleware>();
        app.UseMiddleware<ExceptionHandlingMiddleware>();
        app.UseWhen(ctx => ctx.Request.Path.StartsWithSegments("/api"), branch => branch.UseMiddleware<RequestHeaderValidationMiddleware>());
        app.UseCors();
        app.UseAuthentication();
        app.UseAuthorization();
        return app;
    }

    /// <summary>Unauthenticated liveness probe + Swagger, mapped outside MVC with Map().</summary>
    public static WebApplication MapHrBasics(this WebApplication app, string service)
    {
        app.Map("/ping", branch => branch.Run(ctx => ctx.Response.WriteAsJsonAsync(new { service, status = "UP", time = DateTimeOffset.UtcNow })));
        app.UseSwagger();
        app.UseSwaggerUI(o => o.SwaggerEndpoint("/swagger/v1/swagger.json", service));
        app.MapControllers();
        return app;
    }

    /// <summary>Runs the schema bootstrap (dn_* tables + required-table guard) and then the web host.</summary>
    public static async Task RunHrAsync<TContext>(this WebApplication app, IEnumerable<string> requiredTables, IEnumerable<(string Version, string Sql)>? extraScripts = null) where TContext : HrDbContext
    {
        using (var scope = app.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TContext>();
            await SchemaBootstrap.EnsureAsync(db, app.Logger, requiredTables, extraScripts);
        }
        await app.RunAsync();
    }
}
