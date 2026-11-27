using HR.AuthService.Consumers;
using HR.AuthService.Data;
using HR.AuthService.Services;
using HR.Common.Hosting;

var builder = WebApplication.CreateBuilder(args);
builder.AddHrService<AuthDbContext>("HR.AuthService", "hr_auth_db", 32101);
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<HR.Common.Security.JwtTokenIssuer>();
builder.Services.AddEventHandler<EmployeeExitedHandler>();
builder.Services.AddEventHandler<EmployeeTerminatedHandler>();
builder.Services.AddHostedService<BootstrapAdminService>();

var app = builder.Build();
app.UseHrPipeline();
app.MapHrBasics("HR.AuthService");
await app.RunHrAsync<AuthDbContext>(["user_accounts", "roles", "permissions", "role_permissions", "user_roles", "refresh_tokens", "password_reset_tokens", "audit_history"]);
