using Microsoft.AspNetCore.Http;

namespace StudentMgmt.BuildingBlocks.Common.Middlewares;

/// <summary>
/// First middleware in the pipeline (see Program.cs of every service). Reads the
/// inbound "X-Correlation-Id" header if the caller/another service already set
/// one, otherwise mints a new Guid. Stores it in HttpContext.Items so every later
/// middleware/controller/log line/Kafka event can tag itself with the same id,
/// and echoes it back on the response header.
/// </summary>
public sealed class CorrelationIdMiddleware
{
    public const string HeaderName = "X-Correlation-Id";
    public const string ContextItemKey = "CorrelationId";

    private readonly RequestDelegate _next;

    public CorrelationIdMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var correlationId = context.Request.Headers.TryGetValue(HeaderName, out var existing) && !string.IsNullOrWhiteSpace(existing)
            ? existing.ToString()
            : Guid.NewGuid().ToString();

        context.Items[ContextItemKey] = correlationId;
        context.Response.OnStarting(() =>
        {
            context.Response.Headers[HeaderName] = correlationId;
            return Task.CompletedTask;
        });

        using (Serilog.Context.LogContext.PushProperty("CorrelationId", correlationId))
        {
            await _next(context);
        }
    }
}
