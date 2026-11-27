using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace StudentMgmt.BuildingBlocks.Common.Extensions;

public static class CorsServiceExtensions
{
    public const string PolicyName = "StudentMgmtCorsPolicy";

    /// <summary>
    /// Reads allowed origins from configuration ("Cors:AllowedOrigins" array) and
    /// always additionally allows the well-known local dev ports for Angular
    /// (4200), React/CRA (3000) and Next.js (3000) so local frontend development
    /// works out of the box even if appsettings hasn't been customized yet.
    /// </summary>
    public static IServiceCollection AddAppCors(this IServiceCollection services, IConfiguration configuration)
    {
        var configuredOrigins = configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();

        var defaultDevOrigins = new[]
        {
            "http://localhost:3000",
            "http://localhost:4200",
            "http://localhost:5173"
        };

        var allOrigins = configuredOrigins.Concat(defaultDevOrigins).Distinct().ToArray();

        services.AddCors(options =>
        {
            options.AddPolicy(PolicyName, policy =>
            {
                policy.WithOrigins(allOrigins)
                    .AllowAnyHeader()
                    .AllowAnyMethod()
                    .AllowCredentials();
            });
        });

        return services;
    }
}
