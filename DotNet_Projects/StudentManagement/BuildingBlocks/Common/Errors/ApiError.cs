using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Http;

namespace Common.Errors;

public record ApiError(DateTimeOffset Timestamp, int Status, string Error, string Message, string Path,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IDictionary<string, string[]>? FieldErrors = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? CorrelationId = null);

public static class ApiErrorWriter
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static Task Write(HttpContext ctx, int status, string error, string message, IDictionary<string, string[]>? fields = null)
    {
        ctx.Response.StatusCode = status;
        ctx.Response.ContentType = "application/json";
        var body = new ApiError(DateTimeOffset.UtcNow, status, error, message, ctx.Request.Path, fields,
            ctx.Response.Headers["X-Correlation-Id"].FirstOrDefault());
        return ctx.Response.WriteAsync(JsonSerializer.Serialize(body, Json));
    }
}
