using System.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace StudentMgmt.BuildingBlocks.Common.Middlewares;

/// <summary>
/// Logs every inbound request (method, path, caller) and every outgoing response
/// (status code, elapsed time) as a single structured Serilog event each, tagged
/// with the correlation id pushed onto the LogContext by
/// <see cref="CorrelationIdMiddleware"/>.
/// </summary>
public sealed class RequestResponseLoggingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<RequestResponseLoggingMiddleware> _logger;

    public RequestResponseLoggingMiddleware(RequestDelegate next, ILogger<RequestResponseLoggingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var stopwatch = Stopwatch.StartNew();

        _logger.LogInformation(
            "Request started {Method} {Path}{QueryString} from {RemoteIp}",
            context.Request.Method,
            context.Request.Path,
            context.Request.QueryString,
            context.Connection.RemoteIpAddress);

        await _next(context);

        stopwatch.Stop();

        _logger.LogInformation(
            "Request completed {Method} {Path} responded {StatusCode} in {ElapsedMilliseconds}ms",
            context.Request.Method,
            context.Request.Path,
            context.Response.StatusCode,
            stopwatch.ElapsedMilliseconds);
    }
}
