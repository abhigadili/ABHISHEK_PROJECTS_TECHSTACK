using System.Net;

namespace HR.Common.Common;

/// <summary>Base class for business errors that map to an HTTP status and a stable error code.</summary>
public class HrException(HttpStatusCode status, string code, string message, IReadOnlyList<string>? details = null) : Exception(message)
{
    public HttpStatusCode Status { get; } = status;
    public string Code { get; } = code;
    public IReadOnlyList<string>? Details { get; } = details;
}

public sealed class NotFoundException(string message) : HrException(HttpStatusCode.NotFound, "NOT_FOUND", message);
public sealed class ConflictException(string message) : HrException(HttpStatusCode.Conflict, "CONFLICT", message);
public sealed class ValidationException(string message, IReadOnlyList<string>? details = null) : HrException(HttpStatusCode.BadRequest, "VALIDATION_FAILED", message, details);
public sealed class BusinessRuleException(string message) : HrException(HttpStatusCode.UnprocessableEntity, "BUSINESS_RULE", message);
public sealed class ForbiddenException(string message = "You do not have permission to perform this action") : HrException(HttpStatusCode.Forbidden, "FORBIDDEN", message);
public sealed class UnauthorizedException(string message = "Authentication required") : HrException(HttpStatusCode.Unauthorized, "UNAUTHORIZED", message);
public sealed class TooManyRequestsException(string message) : HrException(HttpStatusCode.TooManyRequests, "RATE_LIMITED", message);
public sealed class DependencyUnavailableException(string message) : HrException(HttpStatusCode.ServiceUnavailable, "DEPENDENCY_UNAVAILABLE", message);
/// <summary>A downstream service rejected the request (4xx) - passed through unchanged.</summary>
public sealed class DownstreamRejectedException(HttpStatusCode status, string code, string message) : HrException(status, code, message);
