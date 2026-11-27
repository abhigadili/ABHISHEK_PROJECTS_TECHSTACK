using System.Net;

namespace HMS.Shared.Common;

/// <summary>Base class for business errors that map to an HTTP status.</summary>
public class ApiException : Exception
{
    public HttpStatusCode Status { get; }
    public ApiException(HttpStatusCode status, string message) : base(message) => Status = status;
}

public sealed class NotFoundException(string message) : ApiException(HttpStatusCode.NotFound, message);
public sealed class ConflictException(string message) : ApiException(HttpStatusCode.Conflict, message);
public sealed class BadRequestException(string message) : ApiException(HttpStatusCode.BadRequest, message);
public sealed class ForbiddenException(string message) : ApiException(HttpStatusCode.Forbidden, message);
public sealed class UnauthorizedException(string message) : ApiException(HttpStatusCode.Unauthorized, message);
public sealed class ServiceUnavailableException(string message) : ApiException(HttpStatusCode.ServiceUnavailable, message);
/// <summary>A downstream service rejected the request with a 4xx other than 404 - passed through, not a failure of the dependency.</summary>
public sealed class DownstreamClientException(HttpStatusCode status, string message) : ApiException(status, message);

public sealed record ApiError(DateTimeOffset Timestamp, int Status, string Error, string Message, string Path, IReadOnlyList<string>? Details = null);

public sealed record PageResponse<T>(IReadOnlyList<T> Content, int Page, int Size, long TotalElements, int TotalPages);
