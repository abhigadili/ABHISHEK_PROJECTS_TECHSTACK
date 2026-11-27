using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using StudentMgmt.BuildingBlocks.Common.Constants;
using StudentMgmt.BuildingBlocks.Common.Security;

namespace StudentMgmt.BuildingBlocks.Common.Extensions;

public static class JwtAuthenticationServiceExtensions
{
    /// <summary>
    /// Registers <see cref="JwtSettings"/> (Options Pattern), the Singleton
    /// <see cref="IJwtTokenService"/>/<see cref="IPasswordHasher"/>, and configures
    /// the JwtBearer authentication handler that every service (not only
    /// student-service) uses to validate incoming access tokens.
    /// </summary>
    public static IServiceCollection AddJwtAuthentication(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<JwtSettings>(configuration.GetSection(JwtSettings.SectionName));
        services.AddSingleton<IJwtTokenService, JwtTokenService>();
        services.AddSingleton<IPasswordHasher, BCryptPasswordHasher>();

        var jwtSettings = configuration.GetSection(JwtSettings.SectionName).Get<JwtSettings>()
            ?? throw new InvalidOperationException("Missing 'Jwt' configuration section.");

        services.AddAuthentication(options =>
            {
                options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
                options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
            })
            .AddJwtBearer(options =>
            {
                options.RequireHttpsMetadata = false;
                options.SaveToken = true;
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidIssuer = jwtSettings.Issuer,
                    ValidateAudience = true,
                    ValidAudience = jwtSettings.Audience,
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings.Secret)),
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.FromSeconds(30)
                };
            });

        services.AddAuthorizationBuilder()
            .AddPolicy(PolicyConstants.AdminOnly, policy => policy.RequireRole(RoleConstants.Admin))
            .AddPolicy(PolicyConstants.CanManageCourses, policy => policy.RequireRole(RoleConstants.Admin, RoleConstants.Faculty))
            .AddPolicy(PolicyConstants.CanManageStudents, policy => policy.RequireRole(RoleConstants.Admin, RoleConstants.Faculty))
            .AddPolicy(PolicyConstants.CanEnroll, policy => policy.RequireRole(RoleConstants.Admin, RoleConstants.Faculty, RoleConstants.Student));

        return services;
    }
}
