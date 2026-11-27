using System.Linq.Expressions;

namespace Common.Paging;

public record PagedResult<T>(IReadOnlyList<T> Content, int Page, int Size, long TotalElements, int TotalPages);

public record PageRequest(int Page, int Size, string SortBy, bool Descending)
{
    /// <summary>Normalises page/size (size capped at 100) and validates the sort column against a whitelist.</summary>
    public static PageRequest Create(int page, int size, string? sort, string defaultSort, ISet<string> allowed)
    {
        var s = string.IsNullOrWhiteSpace(sort) ? defaultSort : sort;
        var parts = s.Split(',');
        var col = allowed.FirstOrDefault(a => a.Equals(parts[0], StringComparison.OrdinalIgnoreCase))
            ?? throw new ArgumentException($"Cannot sort by '{parts[0]}'. Allowed: {string.Join(", ", allowed)}");
        var desc = parts.Length > 1 && parts[1].Equals("desc", StringComparison.OrdinalIgnoreCase);
        return new PageRequest(Math.Max(page, 0), Math.Min(Math.Max(size, 1), 100), col, desc);
    }
}

public static class PagingExtensions
{
    /// <summary>OrderBy on a property name chosen from a whitelist (built as an expression tree so EF translates it to SQL).</summary>
    public static IOrderedQueryable<T> OrderByName<T>(this IQueryable<T> q, string property, bool desc)
    {
        var p = Expression.Parameter(typeof(T), "x");
        var member = Expression.Property(p, property);
        var lambda = Expression.Lambda(member, p);
        var method = desc ? "OrderByDescending" : "OrderBy";
        var call = Expression.Call(typeof(Queryable), method, new[] { typeof(T), member.Type }, q.Expression, Expression.Quote(lambda));
        return (IOrderedQueryable<T>)q.Provider.CreateQuery<T>(call);
    }
}
