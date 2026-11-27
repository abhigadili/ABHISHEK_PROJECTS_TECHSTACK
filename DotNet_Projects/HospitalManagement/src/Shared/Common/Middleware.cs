using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Serilog.Context;
using Grpc.Core;
using Polly.CircuitBreaker;

namespace HMS.Shared.Common;

/// <summary>Reads/creates X-Correlation-Id, returns it to the caller and puts it on every log event of the request.</summary>
public sealed class CorrelationIdMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext ctx)
    {
        var id = ctx.Request.Headers[CorrelationContext.HeaderName].FirstOrDefault();
        if (string.IsNullOrWhiteSpace(id) || id.Length > 64) id = CorrelationContext.NewId();
        CorrelationContext.Id = id;
        ctx.Response.Headers[CorrelationContext.HeaderName] = id;
        using (LogContext.PushProperty("CorrelationId", id))
            await next(ctx);
    }
}

/// <summary>One consistent JSON error contract for every service (same shape as the rest of the platform).</summary>
public sealed class ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> log)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public async Task InvokeAsync(HttpContext ctx)
    {
        try
        {
            await next(ctx);
        }
        catch (ApiException ex)
        {
            if ((int)ex.Status >= 500) log.LogWarning("{Method} {Path} -> {Status}: {Message}", ctx.Request.Method, ctx.Request.Path, (int)ex.Status, ex.Message);
            await Write(ctx, ex.Status, ex.Message);
        }
        catch (BrokenCircuitException ex)
        {
            log.LogWarning("Circuit open on {Path}: {Message}", ctx.Request.Path, ex.Message);
            await Write(ctx, HttpStatusCode.ServiceUnavailable, "A dependent service is temporarily unavailable (circuit open)");
        }
        catch (RpcException ex)
        {
            log.LogWarning("gRPC failure on {Path}: {Code}", ctx.Request.Path, ex.StatusCode);
            await Write(ctx, ex.StatusCode switch
            {
                StatusCode.NotFound => HttpStatusCode.NotFound,
                StatusCode.PermissionDenied => HttpStatusCode.Forbidden,
                StatusCode.Unauthenticated => HttpStatusCode.Unauthorized,
                StatusCode.InvalidArgument => HttpStatusCode.BadRequest,
                _ => HttpStatusCode.ServiceUnavailable
            }, ex.StatusCode == StatusCode.NotFound ? ex.Status.Detail : "A dependent service is unavailable");
        }
        catch (Microsoft.EntityFrameworkCore.DbUpdateConcurrencyException)
        {
            await Write(ctx, HttpStatusCode.Conflict, "The resource was modified concurrently, please retry");
        }
        catch (Microsoft.EntityFrameworkCore.DbUpdateException ex)
        {
            log.LogWarning(ex, "Data integrity violation on {Path}", ctx.Request.Path);
            await Write(ctx, HttpStatusCode.Conflict, "The request conflicts with existing data (duplicate or constraint violation)");
        }
        catch (OperationCanceledException) when (ctx.RequestAborted.IsCancellationRequested)
        {
            ctx.Response.StatusCode = 499;   // client closed the request
        }
        catch (BadHttpRequestException ex)
        {
            await Write(ctx, HttpStatusCode.BadRequest, "Malformed request: " + ex.Message);
        }
        catch (JsonException ex)
        {
            await Write(ctx, HttpStatusCode.BadRequest, "Malformed JSON: " + ex.Message);
        }
        catch (Exception ex)
        {
            log.LogError(ex, "Unhandled error on {Method} {Path}", ctx.Request.Method, ctx.Request.Path);
            await Write(ctx, HttpStatusCode.InternalServerError, "Unexpected internal error");
        }
    }

    public static Task Write(HttpContext ctx, HttpStatusCode status, string message, IReadOnlyList<string>? details = null)
    {
        if (ctx.Response.HasStarted) return Task.CompletedTask;
        ctx.Response.Clear();
        ctx.Response.StatusCode = (int)status;
        ctx.Response.ContentType = "application/json";
        var reason = Microsoft.AspNetCore.WebUtilities.ReasonPhrases.GetReasonPhrase((int)status);
        return ctx.Response.WriteAsync(JsonSerializer.Serialize(new ApiError(DateTimeOffset.UtcNow, (int)status, reason, message, ctx.Request.Path, details), Json));
    }
}
