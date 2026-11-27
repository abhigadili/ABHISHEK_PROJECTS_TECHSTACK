namespace StudentMgmt.BuildingBlocks.Common.Exceptions;

/// <summary>Base type for every custom exception so middleware can pattern-match on it.</summary>
public abstract class AppException : Exception
{
    protected AppException(string message) : base(message) { }
}

/// <summary>Maps to HTTP 404. Thrown when a lookup by id/key finds nothing.</summary>
public sealed class NotFoundException : AppException
{
    public NotFoundException(string entityName, object key)
        : base($"{entityName} with identifier '{key}' was not found.") { }
}

/// <summary>Maps to HTTP 409/422. Thrown when an operation violates a domain rule
/// (e.g. enrolling in a course that is already at capacity).</summary>
public sealed class BusinessRuleException : AppException
{
    public BusinessRuleException(string message) : base(message) { }
}

/// <summary>Maps to HTTP 400. Thrown when FluentValidation rejects a request.</summary>
public sealed class ValidationAppException : AppException
{
    public IReadOnlyDictionary<string, string[]> Errors { get; }

    public ValidationAppException(IReadOnlyDictionary<string, string[]> errors)
        : base("One or more validation errors occurred.")
    {
        Errors = errors;
    }
}

/// <summary>Maps to HTTP 401. Thrown for bad credentials or an expired/invalid refresh token.</summary>
public sealed class AuthenticationFailedException : AppException
{
    public AuthenticationFailedException(string message) : base(message) { }
}

/// <summary>Maps to HTTP 403. Thrown when an authenticated user lacks the required role/permission.</summary>
public sealed class ForbiddenException : AppException
{
    public ForbiddenException(string message) : base(message) { }
}

/// <summary>Maps to HTTP 500. Wraps an unexpected database failure with a caller-safe message.</summary>
public sealed class DatabaseOperationException : AppException
{
    public DatabaseOperationException(string message, Exception inner) : base(message)
    {
        HResult = inner.HResult;
    }
}

/// <summary>Maps to HTTP 502. Wraps a Kafka publish/consume failure that made it past the retry pipeline.</summary>
public sealed class MessagingException : AppException
{
    public MessagingException(string message) : base(message) { }
}
