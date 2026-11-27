using Asp.Versioning;
using Microsoft.Extensions.DependencyInjection;

namespace StudentMgmt.BuildingBlocks.Common.Extensions;

public static class ApiVersioningServiceExtensions
{
    /// <summary>Registers URL-segment API versioning (e.g. /api/v1/students) with
    /// v1 as the current default and room for a future v2 without breaking v1 clients.</summary>
    public static IServiceCollection AddAppApiVersioning(this IServiceCollection services)
    {
        services.AddApiVersioning(options =>
            {
                options.DefaultApiVersion = new ApiVersion(1, 0);
                options.AssumeDefaultVersionWhenUnspecified = true;
                options.ReportApiVersions = true;
            })
            .AddMvc()
            .AddApiExplorer(options =>
            {
                options.GroupNameFormat = "'v'VVV";
                options.SubstituteApiVersionInUrl = true;
            });

        return services;
    }
}
