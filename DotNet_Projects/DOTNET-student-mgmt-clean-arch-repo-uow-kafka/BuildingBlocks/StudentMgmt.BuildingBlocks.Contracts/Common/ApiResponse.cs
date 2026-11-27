namespace StudentMgmt.BuildingBlocks.Contracts.Common;

/// <summary>
/// Uniform envelope every controller action returns, so every client (and every
/// service) can rely on the same shape whether the call succeeded or failed.
/// </summary>
public class ApiResponse<T>
{
    public bool Success { get; init; }
    public string Message { get; init; } = string.Empty;
    public T? Data { get; init; }
    public IReadOnlyList<string> Errors { get; init; } = Array.Empty<string>();
    public string? CorrelationId { get; init; }

    public static ApiResponse<T> Ok(T data, string message = "Request completed successfully", string? correlationId = null) =>
        new() { Success = true, Message = message, Data = data, CorrelationId = correlationId };

    public static ApiResponse<T> Fail(string message, IReadOnlyList<string>? errors = null, string? correlationId = null) =>
        new() { Success = false, Message = message, Errors = errors ?? Array.Empty<string>(), CorrelationId = correlationId };
}
