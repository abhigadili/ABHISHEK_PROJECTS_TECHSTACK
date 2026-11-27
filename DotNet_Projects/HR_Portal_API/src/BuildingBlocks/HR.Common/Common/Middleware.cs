using System.Net;
using System.Text.Json;
using HR.Common.Security;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Polly.CircuitBreaker;
using Serilog.Context;

namespace HR.Common.Common;

/// <summary>Middleware #1: reads/creates X-Correlation-Id, returns it to the caller and tags every log event of the request.</summary>
public sealed class CorrelationIdMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext ctx)
    {
        var id = ctx.Request.Headers[CorrelationContext.HeaderName].FirstOrDefault();
        if (string.IsNullOrWhiteSpace(id) || id.Length > 64 || id.Any(c => !char.IsLetterOrDigit(c) && c != '-' && c != '_')) id = CorrelationContext.NewId();
        CorrelationContext.Id = id;
        ctx.Items[CorrelationContext.HeaderName] = id;
        ctx.Response.Headers[CorrelationContext.HeaderName] = id;
        using (LogContext.PushProperty("CorrelationId", id)) await next(ctx);
    }
}

/// <summary>Middleware: baseline secure HTTP response headers for an API.</summary>
public sealed class SecurityHeadersMiddleware(RequestDelegate next)
{
    public Task InvokeAsync(HttpContext ctx)
    {
        var h = ctx.Response.Headers;
        h["X-Content-Type-Options"] = "nosniff";
        h["X-Frame-Options"] = "DENY";
        h["Referrer-Policy"] = "no-referrer";
        h["Cache-Control"] = "no-store";
        h["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'";
        h.Remove("Server");
        return next(ctx);
    }
}

/// <summary>Middleware: rejects write requests with a body but an unsupported media type, and absurdly long header values.</summary>
public sealed class RequestHeaderValidationMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext ctx)
    {
        var r = ctx.Request;
        if (r.Headers.Any(h => h.Value.ToString().Length > 8192))
        {
            await ExceptionHandlingMiddleware.Write(ctx, HttpStatusCode.RequestHeaderFieldsTooLarge, "BAD_REQUEST", "A request header is too large");
            return;
        }
        if ((HttpMethods.IsPost(r.Method) || HttpMethods.IsPut(r.Method) || HttpMethods.IsPatch(r.Method)) && r.ContentLength > 0)
        {
            var ct = r.ContentType ?? "";
            if (!ct.StartsWith("application/json", StringComparison.OrdinalIgnoreCase) && !ct.StartsWith("multipart/form-data", StringComparison.OrdinalIgnoreCase))
            {
                await ExceptionHandlingMiddleware.Write(ctx, HttpStatusCode.UnsupportedMediaType, "UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json or multipart/form-data");
                return;
            }
        }
        await next(ctx);
    }
}

/// <summary>Middleware: one structured line per request with status, duration, user id (never tokens or bodies).</summary>
public sealed class RequestLoggingMiddleware(RequestDelegate next, ILogger<RequestLoggingMiddleware> log)
{
    public async Task InvokeAsync(HttpContext ctx)
    {
        var started = System.Diagnostics.Stopwatch.GetTimestamp();
        try { await next(ctx); }
        finally
        {
            var ms = System.Diagnostics.Stopwatch.GetElapsedTime(started).TotalMilliseconds;
            var level = ctx.Response.StatusCode >= 500 ? LogLevel.Error : ctx.Response.StatusCode >= 400 ? LogLevel.Warning : LogLevel.Information;
            log.Log(level, "{Method} {Path} -> {Status} in {Elapsed:0.0} ms user={User}", ctx.Request.Method, ctx.Request.Path.Value, ctx.Response.StatusCode, ms,
                ctx.User.FindFirst("sub")?.Value ?? "-");
        }
    }
}

/// <summary>Global exception handling middleware: maps every failure to the standard error envelope without leaking internals (e.g. SQL errors).</summary>
public sealed class ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> log)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public async Task InvokeAsync(HttpContext ctx)
    {
        try { await next(ctx); }
        catch (HrException ex)
        {
            if ((int)ex.Status >= 500) log.LogWarning("{Method} {Path} -> {Status}: {Message}", ctx.Request.Method, ctx.Request.Path, (int)ex.Status, ex.Message);
            await Write(ctx, ex.Status, ex.Code, ex.Message, ex.Details);
        }
        catch (BrokenCircuitException)
        {
            await Write(ctx, HttpStatusCode.ServiceUnavailable, "DEPENDENCY_UNAVAILABLE", "A dependent service is temporarily unavailable (circuit open)");
        }
        catch (Microsoft.EntityFrameworkCore.DbUpdateConcurrencyException)
        {
            await Write(ctx, HttpStatusCode.Conflict, "OPTIMISTIC_LOCK", "The resource was modified concurrently, please reload and retry");
        }
        catch (Microsoft.EntityFrameworkCore.DbUpdateException ex)
        {
            log.LogWarning(ex, "Data integrity violation on {Path}", ctx.Request.Path);
            await Write(ctx, HttpStatusCode.Conflict, "DATA_CONFLICT", "The request conflicts with existing data (duplicate, missing reference or constraint violation)");
        }
        catch (MySqlConnector.MySqlException ex)
        {
            log.LogError(ex, "Database error on {Path} (code {Code})", ctx.Request.Path, ex.ErrorCode);
            await Write(ctx, ex.ErrorCode == MySqlConnector.MySqlErrorCode.DuplicateKeyEntry ? HttpStatusCode.Conflict : HttpStatusCode.InternalServerError,
                "DATABASE_ERROR", ex.ErrorCode == MySqlConnector.MySqlErrorCode.DuplicateKeyEntry ? "Duplicate value" : "A database error occurred");
        }
        catch (OperationCanceledException) when (ctx.RequestAborted.IsCancellationRequested) { ctx.Response.StatusCode = 499; }
        catch (BadHttpRequestException ex) { await Write(ctx, HttpStatusCode.BadRequest, "BAD_REQUEST", "Malformed request: " + ex.Message); }
        catch (JsonException ex) { await Write(ctx, HttpStatusCode.BadRequest, "BAD_REQUEST", "Malformed JSON: " + ex.Message); }
        catch (Exception ex)
        {
            log.LogError(ex, "Unhandled error on {Method} {Path}", ctx.Request.Method, ctx.Request.Path);
            await Write(ctx, HttpStatusCode.InternalServerError, "INTERNAL_ERROR", "Unexpected internal error");
        }
    }

    public static Task Write(HttpContext ctx, HttpStatusCode status, string code, string message, IReadOnlyList<string>? details = null)
    {
        if (ctx.Response.HasStarted) return Task.CompletedTask;
        ctx.Response.Clear();
        ctx.Response.StatusCode = (int)status;
        ctx.Response.ContentType = "application/json";
        var body = new ApiErrorResponse(false, (int)status, new ApiErrorBody(code, message, details), ctx.Request.Path, CorrelationContext.Id, DateTimeOffset.UtcNow);
        return ctx.Response.WriteAsync(JsonSerializer.Serialize(body, Json));
    }
}
