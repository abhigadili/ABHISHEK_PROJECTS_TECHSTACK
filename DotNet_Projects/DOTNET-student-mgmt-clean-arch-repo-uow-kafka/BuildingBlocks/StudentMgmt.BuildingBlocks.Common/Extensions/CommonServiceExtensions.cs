using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using StudentMgmt.BuildingBlocks.Common.Caching;
using StudentMgmt.BuildingBlocks.Common.Middlewares;

namespace StudentMgmt.BuildingBlocks.Common.Extensions;

public static class CommonServiceExtensions
{
    public static IServiceCollection AddSharedCommonServices(this IServiceCollection services)
    {
        services.AddSingleton<ICacheService, InMemoryCacheService>();
        return services;
    }

    /// <summary>
    /// Registers, in order, the three cross-cutting middlewares every service's
    /// Program.cs must run first: correlation id, request/response logging, then
    /// global exception handling (kept last of the three so it can catch failures
    /// from anything downstream, while still running before MVC's own pipeline).
    /// </summary>
    public static IApplicationBuilder UseSharedMiddlewares(this IApplicationBuilder app)
    {
        app.UseMiddleware<CorrelationIdMiddleware>();
        app.UseMiddleware<RequestResponseLoggingMiddleware>();
        app.UseMiddleware<ExceptionHandlingMiddleware>();
        return app;
    }
}
