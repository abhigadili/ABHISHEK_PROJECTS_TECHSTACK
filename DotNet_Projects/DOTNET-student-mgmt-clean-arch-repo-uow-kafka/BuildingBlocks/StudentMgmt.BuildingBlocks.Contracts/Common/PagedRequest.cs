namespace StudentMgmt.BuildingBlocks.Contracts.Common;

/// <summary>
/// Generic query parameters accepted by every "list" endpoint. Bound from the
/// query string, e.g. GET /api/v1/students?pageNumber=2&amp;pageSize=20&amp;sortBy=lastName&amp;sortDescending=true&amp;searchTerm=amy
/// </summary>
public class PagedRequest
{
    private const int MaxPageSize = 100;
    private int _pageSize = 10;

    public int PageNumber { get; set; } = 1;

    public int PageSize
    {
        get => _pageSize;
        set => _pageSize = value <= 0 ? 10 : Math.Min(value, MaxPageSize);
    }

    public string? SortBy { get; set; }
    public bool SortDescending { get; set; }
    public string? SearchTerm { get; set; }
}
