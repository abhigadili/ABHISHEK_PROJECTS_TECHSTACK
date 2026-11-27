using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using StudentMgmt.BuildingBlocks.Common.Exceptions;
using StudentMgmt.BuildingBlocks.Contracts.Common;

namespace StudentMgmt.BuildingBlocks.Common.Middlewares;

/// <summary>
/// Global Exception Handling Middleware. Every controller lets exceptions bubble
/// up instead of wrapping every action in try/catch; this single place converts
/// every known <see cref="AppException"/> subtype (and anything unexpected) into
/// a consistent <see cref="ApiResponse{T}"/> JSON body with the correct HTTP
/// status code, and logs it with the request's correlation id attached.
/// </summary>
public sealed class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            await HandleAsync(context, ex);
        }
    }

    private async Task HandleAsync(HttpContext context, Exception exception)
    {
        var correlationId = context.Items.TryGetValue(CorrelationIdMiddleware.ContextItemKey, out var id)
            ? id?.ToString()
            : null;

        var (statusCode, message, errors) = exception switch
        {
            NotFoundException => (HttpStatusCode.NotFound, exception.Message, Array.Empty<string>()),
            ValidationAppException validationEx => (
                HttpStatusCode.BadRequest,
                exception.Message,
                validationEx.Errors.SelectMany(kv => kv.Value.Select(v => $"{kv.Key}: {v}")).ToArray()),
            BusinessRuleException => (HttpStatusCode.Conflict, exception.Message, Array.Empty<string>()),
            AuthenticationFailedException => (HttpStatusCode.Unauthorized, exception.Message, Array.Empty<string>()),
            ForbiddenException => (HttpStatusCode.Forbidden, exception.Message, Array.Empty<string>()),
            MessagingException => (HttpStatusCode.BadGateway, exception.Message, Array.Empty<string>()),
            DatabaseOperationException => (HttpStatusCode.InternalServerError, exception.Message, Array.Empty<string>()),
            _ => (HttpStatusCode.InternalServerError, "An unexpected error occurred. Please try again later.", Array.Empty<string>())
        };

        if (statusCode == HttpStatusCode.InternalServerError)
        {
            _logger.LogError(exception, "Unhandled exception for CorrelationId {CorrelationId}", correlationId);
        }
        else
        {
            _logger.LogWarning(exception, "Handled exception ({StatusCode}) for CorrelationId {CorrelationId}", statusCode, correlationId);
        }

        var response = ApiResponse<object>.Fail(message, errors, correlationId);

        context.Response.ContentType = "application/json";
        context.Response.StatusCode = (int)statusCode;
        await context.Response.WriteAsync(JsonSerializer.Serialize(response));
    }
}
