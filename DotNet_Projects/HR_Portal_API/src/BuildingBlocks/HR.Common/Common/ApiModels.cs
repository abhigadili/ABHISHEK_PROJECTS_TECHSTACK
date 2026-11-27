using System.Text.Json.Serialization;

namespace HR.Common.Common;

/// <summary>Standard success envelope returned by every endpoint.</summary>
public sealed record ApiResponse<T>(bool Success, T? Data, string? CorrelationId, DateTimeOffset Timestamp)
{
    public static ApiResponse<T> Ok(T data) => new(true, data, CorrelationContext.Id, DateTimeOffset.UtcNow);
}

public sealed record ApiErrorBody(string Code, string Message, IReadOnlyList<string>? Details);

/// <summary>Standard error envelope (same contract as the other HR Portal builds).</summary>
public sealed record ApiErrorResponse(bool Success, int Status, ApiErrorBody Error, string Path, string? CorrelationId, DateTimeOffset Timestamp);

public sealed record PagedResult<T>(IReadOnlyList<T> Items, int Page, int Size, long Total, int TotalPages)
{
    public static PagedResult<T> Of(IReadOnlyList<T> items, int page, int size, long total) =>
        new(items, page, size, total, size == 0 ? 0 : (int)Math.Ceiling(total / (double)size));
}

/// <summary>Common paging / sorting / search query-string parameters.</summary>
public class PageQuery
{
    private int _page = 1, _size = 20;
    public int Page { get => _page; set => _page = Math.Max(1, value); }
    public int Size { get => _size; set => _size = Math.Clamp(value, 1, 200); }
    public string? Sort { get; set; }
    public string Dir { get; set; } = "asc";
    public string? Search { get; set; }
    [JsonIgnore] public bool Descending => string.Equals(Dir, "desc", StringComparison.OrdinalIgnoreCase);
}
