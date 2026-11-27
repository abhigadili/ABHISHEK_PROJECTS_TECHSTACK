using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Common.Errors;

/// <summary>Central exception → HTTP mapping (the .NET counterpart of a Spring @RestControllerAdvice).</summary>
public class GlobalExceptionHandler(ILogger<GlobalExceptionHandler> log) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext ctx, Exception ex, CancellationToken ct)
    {
        (int status, string error, string msg) = ex switch
        {
            NotFoundException e => (404, "Not Found", e.Message),
            ConflictException e => (409, "Conflict", e.Message),
            DbUpdateConcurrencyException => (409, "Conflict", "The record was changed by someone else; reload and retry"),
            DbUpdateException e when IsDuplicate(e) => (409, "Conflict", "Operation violates a uniqueness or integrity constraint"),
            BusinessRuleException e => (422, "Unprocessable Entity", e.Message),
            UnauthorizedAppException e => (401, "Unauthorized", e.Message),
            ForbiddenException e => (403, "Forbidden", e.Message),
            ServiceUnavailableException e => (503, "Service Unavailable", e.Message),
            BadHttpRequestException e => (400, "Bad Request", "Malformed request: " + e.Message),
            System.Text.Json.JsonException e => (400, "Bad Request", "Malformed request: " + e.Message),
            ArgumentException e => (400, "Bad Request", "Malformed request: " + e.Message),
            _ => (500, "Internal Server Error", "Unexpected server error"),
        };
        if (status >= 500) log.LogError(ex, "Unhandled exception on {Method} {Path}", ctx.Request.Method, ctx.Request.Path);
        else log.LogWarning("{Type} on {Method} {Path}: {Message}", ex.GetType().Name, ctx.Request.Method, ctx.Request.Path, ex.Message);
        await ApiErrorWriter.Write(ctx, status, error, msg);
        return true;
    }

    private static bool IsDuplicate(DbUpdateException e) => e.InnerException?.Message.Contains("Duplicate entry", StringComparison.OrdinalIgnoreCase) == true
        || e.InnerException?.Message.Contains("constraint", StringComparison.OrdinalIgnoreCase) == true;
}
