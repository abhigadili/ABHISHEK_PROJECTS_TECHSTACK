using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Common.Security;

public static class AuthExtensions
{
    /// <summary>JWT bearer authentication with the shared secret. MapInboundClaims is disabled so claim names stay as issued.</summary>
    public static IServiceCollection AddSmsJwtAuth(this IServiceCollection services, IConfiguration config)
    {
        services.Configure<JwtOptions>(config.GetSection(JwtOptions.Section));
        services.AddSingleton<JwtTokenService>();
        var opts = config.GetSection(JwtOptions.Section).Get<JwtOptions>() ?? new JwtOptions();
        if (string.IsNullOrWhiteSpace(opts.Secret) || opts.Secret.Length < 32)
            throw new InvalidOperationException("Jwt:Secret must be at least 32 characters (set Jwt__Secret).");
        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(o =>
        {
            o.MapInboundClaims = false;
            o.TokenValidationParameters = JwtTokenService.ValidationParameters(opts);
            // JSON 401 instead of an empty body
            o.Events = new JwtBearerEvents
            {
                OnChallenge = async ctx =>
                {
                    ctx.HandleResponse();
                    await Errors.ApiErrorWriter.Write(ctx.HttpContext, 401, "Unauthorized", "Authentication required or token invalid/expired");
                },
                OnForbidden = ctx => Errors.ApiErrorWriter.Write(ctx.HttpContext, 403, "Forbidden", "You do not have permission to perform this action"),
            };
        });
        services.AddAuthorization();
        return services;
    }

    public static long? StudentId(this ClaimsPrincipal p) => long.TryParse(p.FindFirstValue(JwtTokenService.StudentIdClaim), out var v) ? v : null;
    public static bool IsStaffOrAdmin(this ClaimsPrincipal p) => p.IsInRole(Roles.Admin) || p.IsInRole(Roles.Staff) || p.IsInRole(Roles.Service);
}
