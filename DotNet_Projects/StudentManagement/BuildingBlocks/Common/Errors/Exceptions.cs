namespace Common.Errors;

/// <summary>HTTP 404</summary>
public class NotFoundException(string message) : Exception(message);
/// <summary>HTTP 409: duplicate, concurrency conflict, no seats left...</summary>
public class ConflictException(string message) : Exception(message);
/// <summary>HTTP 422: well-formed request that violates a business rule.</summary>
public class BusinessRuleException(string message) : Exception(message);
/// <summary>HTTP 401: bad credentials / invalid refresh token.</summary>
public class UnauthorizedAppException(string message) : Exception(message);
/// <summary>HTTP 403 raised from application code (ownership checks).</summary>
public class ForbiddenException(string message) : Exception(message);
/// <summary>HTTP 503: a dependency is unavailable (circuit open, timeout...).</summary>
public class ServiceUnavailableException(string message, Exception? inner = null) : Exception(message, inner);
