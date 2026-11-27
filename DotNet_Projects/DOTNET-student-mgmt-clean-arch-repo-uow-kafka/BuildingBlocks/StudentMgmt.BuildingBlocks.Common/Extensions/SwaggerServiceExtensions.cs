using Microsoft.Extensions.DependencyInjection;
using Microsoft.OpenApi.Models;

namespace StudentMgmt.BuildingBlocks.Common.Extensions;

public static class SwaggerServiceExtensions
{
    /// <summary>Adds Swagger/OpenAPI generation with a JWT Bearer "Authorize" button
    /// so a token obtained from /api/v1/auth/login can be pasted straight into Swagger UI.</summary>
    public static IServiceCollection AddAppSwagger(this IServiceCollection services, string serviceTitle)
    {
        services.AddEndpointsApiExplorer();
        services.AddSwaggerGen(options =>
        {
            options.SwaggerDoc("v1", new OpenApiInfo
            {
                Title = serviceTitle,
                Version = "v1",
                Description = $"{serviceTitle} — part of the Student Management microservices system."
            });

            var securityScheme = new OpenApiSecurityScheme
            {
                Name = "Authorization",
                Type = SecuritySchemeType.Http,
                Scheme = "bearer",
                BearerFormat = "JWT",
                In = ParameterLocation.Header,
                Description = "Paste the access token returned by /api/v1/auth/login (no need to type \"Bearer \" — Swagger adds it automatically)."
            };

            options.AddSecurityDefinition("Bearer", securityScheme);
            options.AddSecurityRequirement(new OpenApiSecurityRequirement
            {
                {
                    new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" } },
                    Array.Empty<string>()
                }
            });
        });

        return services;
    }
}
