using System.Diagnostics;
using Microsoft.AspNetCore.Http;
using Serilog.Context;

namespace Common.Web;

/// <summary>Reads or creates X-Correlation-Id, echoes it in the response, pushes it into the Serilog log context and the current Activity (trace baggage tag).</summary>
public class CorrelationIdMiddleware(RequestDelegate next)
{
    public const string Header = "X-Correlation-Id";

    public async Task Invoke(HttpContext ctx)
    {
        var id = ctx.Request.Headers[Header].FirstOrDefault();
        if (string.IsNullOrWhiteSpace(id)) id = Guid.NewGuid().ToString();
        ctx.Items[Header] = id;
        ctx.Request.Headers[Header] = id;      // the gateway's reverse proxy forwards request headers, so downstream services receive it
        ctx.Response.OnStarting(() => { ctx.Response.Headers[Header] = id; return Task.CompletedTask; });
        Activity.Current?.SetTag("correlation.id", id);
        using (LogContext.PushProperty("CorrelationId", id))
            await next(ctx);
    }

    public static string? Current(HttpContext? ctx) => ctx?.Items[Header] as string;
}
