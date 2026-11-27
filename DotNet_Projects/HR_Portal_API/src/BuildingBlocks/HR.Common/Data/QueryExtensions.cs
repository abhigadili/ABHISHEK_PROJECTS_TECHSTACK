using System.Linq.Expressions;
using System.Reflection;
using HR.Common.Common;
using Microsoft.EntityFrameworkCore;

namespace HR.Common.Data;

public static class QueryExtensions
{
    /// <summary>Server-side paging (COUNT + OFFSET/LIMIT) projected to DTOs so no entity ever leaves the service layer.</summary>
    public static async Task<PagedResult<TOut>> ToPagedAsync<TIn, TOut>(this IQueryable<TIn> q, PageQuery page, Expression<Func<TIn, TOut>> selector, CancellationToken ct = default)
    {
        var total = await q.LongCountAsync(ct);
        var items = await q.Skip((page.Page - 1) * page.Size).Take(page.Size).Select(selector).ToListAsync(ct);
        return PagedResult<TOut>.Of(items, page.Page, page.Size, total);
    }

    /// <summary>
    /// Dynamic sorting restricted to an allowlist of property names (SQL injection prevention: the client never chooses a column
    /// name; the sort key must match an allowed CLR property and the expression is built from reflection, never string SQL).
    /// </summary>
    public static IQueryable<T> OrderByAllowed<T>(this IQueryable<T> q, string? sort, bool desc, IReadOnlyCollection<string> allowed, string defaultSort)
    {
        var name = allowed.FirstOrDefault(a => string.Equals(a, sort, StringComparison.OrdinalIgnoreCase)) ?? defaultSort;
        var prop = typeof(T).GetProperty(name, BindingFlags.Public | BindingFlags.Instance | BindingFlags.IgnoreCase)
                   ?? throw new ValidationException($"Cannot sort by '{name}'");
        var p = Expression.Parameter(typeof(T), "x");
        var body = Expression.Property(p, prop);
        var lambda = Expression.Lambda(body, p);
        var method = (desc ? "OrderByDescending" : "OrderBy");
        var call = Expression.Call(typeof(Queryable), method, [typeof(T), prop.PropertyType], q.Expression, Expression.Quote(lambda));
        return q.Provider.CreateQuery<T>(call);
    }

    /// <summary>Escapes LIKE wildcards so user search text is matched literally.</summary>
    public static string EscapeLike(this string s) => s.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_");
}
