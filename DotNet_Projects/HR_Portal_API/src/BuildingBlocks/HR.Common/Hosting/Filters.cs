using Microsoft.Extensions.DependencyInjection;
using System.Text.Json;
using FluentValidation;
using HR.Common.Cache;
using HR.Common.Common;
using HR.Common.Security;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Logging;

namespace HR.Common.Hosting;

/// <summary>Global result filter: wraps every successful object result in the standard {success,data,correlationId,timestamp} envelope.</summary>
public sealed class ApiResponseFilter : IAsyncResultFilter
{
    public Task OnResultExecutionAsync(ResultExecutingContext ctx, ResultExecutionDelegate next)
    {
        if (ctx.Result is ObjectResult { Value: not null } o && o.StatusCode is null or < 400 && o.Value.GetType() is { } t && !(t.IsGenericType && t.GetGenericTypeDefinition() == typeof(ApiResponse<>)))
        {
            var wrapped = typeof(ApiResponse<>).MakeGenericType(t).GetMethod("Ok")!.Invoke(null, [o.Value])!;
            ctx.Result = new ObjectResult(wrapped) { StatusCode = o.StatusCode };
        }
        return next();
    }
}

/// <summary>Global action filter: runs FluentValidation validators registered for the action's argument types (400 with per-field details).</summary>
public sealed class FluentValidationFilter(IServiceProvider services) : IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext ctx, ActionExecutionDelegate next)
    {
        var errors = new List<string>();
        foreach (var arg in ctx.ActionArguments.Values.Where(a => a is not null))
        {
            var validator = services.GetService(typeof(IValidator<>).MakeGenericType(arg!.GetType())) as IValidator;
            if (validator is null) continue;
            var result = await validator.ValidateAsync(new ValidationContext<object>(arg));
            errors.AddRange(result.Errors.Select(e => $"{Camel(e.PropertyName)}: {e.ErrorMessage}"));
        }
        if (errors.Count > 0) throw new Common.ValidationException("Validation failed", errors);
        await next();
    }

    private static string Camel(string s) => string.IsNullOrEmpty(s) ? s : char.ToLowerInvariant(s[0]) + s[1..];
}

/// <summary>Global exception filter (MVC layer): logs business failures with the failing controller/action; the middleware renders the response.</summary>
public sealed class BusinessExceptionLoggingFilter(ILogger<BusinessExceptionLoggingFilter> log) : IExceptionFilter
{
    public void OnException(ExceptionContext ctx)
    {
        if (ctx.Exception is HrException ex)
            log.LogInformation("Business rule/problem in {Action}: {Code} {Message}", ctx.ActionDescriptor.DisplayName, ex.Code, ex.Message);
    }
}

/// <summary>Action filter (attribute): fixed-window rate limit per client IP and route on Redis. Used on public endpoints (login, password reset).</summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class RateLimitAttribute(int perMinute) : Attribute, IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext ctx, ActionExecutionDelegate next)
    {
        var redis = ctx.HttpContext.RequestServices.GetRequiredService<IRedisService>();
        var ip = ctx.HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        var window = DateTimeOffset.UtcNow.ToUnixTimeSeconds() / 60;
        var n = await redis.IncrementWindowAsync($"ratelimit:svc:{ctx.ActionDescriptor.DisplayName}:{ip}:{window}", TimeSpan.FromSeconds(70));
        if (n > perMinute) throw new TooManyRequestsException("Too many requests, please retry in a minute");
        await next();
    }
}

/// <summary>
/// Resource filter (attribute): idempotency for critical POSTs. A repeated request with the same Idempotency-Key header (per user + route)
/// replays the stored response instead of executing again; a concurrent duplicate gets 409.
/// </summary>
[AttributeUsage(AttributeTargets.Method)]
public sealed class IdempotentAttribute : Attribute, IAsyncResourceFilter
{
    public async Task OnResourceExecutionAsync(ResourceExecutingContext ctx, ResourceExecutionDelegate next)
    {
        var key = ctx.HttpContext.Request.Headers["Idempotency-Key"].FirstOrDefault();
        if (string.IsNullOrWhiteSpace(key)) { await next(); return; }
        if (key.Length > 100) throw new Common.ValidationException("Idempotency-Key is too long");
        var redis = ctx.HttpContext.RequestServices.GetRequiredService<IRedisService>();
        var user = ctx.HttpContext.User.FindFirst("sub")?.Value ?? "anon";
        var rk = $"idem:{user}:{ctx.ActionDescriptor.DisplayName}:{key}";
        var stored = await redis.GetStringAsync(rk);
        if (stored is not null && stored != "IN_PROGRESS")
        {
            var doc = JsonDocument.Parse(stored);
            ctx.Result = new ContentResult { StatusCode = doc.RootElement.GetProperty("status").GetInt32(), ContentType = "application/json", Content = doc.RootElement.GetProperty("body").GetRawText() };
            ctx.HttpContext.Response.Headers["Idempotent-Replay"] = "true";
            return;
        }
        if (!await redis.SetIfAbsentAsync(rk, "IN_PROGRESS", TimeSpan.FromMinutes(2))) throw new ConflictException("A request with this Idempotency-Key is already being processed");
        var executed = await next();
        if (executed.Result is ObjectResult { StatusCode: null or < 300 } r)
        {
            var body = JsonSerializer.Serialize(r.Value, new JsonSerializerOptions(JsonSerializerDefaults.Web) { Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter() } });
            await redis.SetStringAsync(rk, JsonSerializer.Serialize(new { status = r.StatusCode ?? 200, body = JsonDocument.Parse(body).RootElement }), TimeSpan.FromHours(24));
        }
        else await redis.DeleteAsync(rk);
    }
}

/// <summary>Base controller: thin HTTP adapters only. Business logic lives in services.</summary>
[ApiController]
[Produces("application/json")]
public abstract class HrControllerBase : ControllerBase
{
    protected IActionResult Created<T>(string location, T value) => base.Created(location, value);
}
