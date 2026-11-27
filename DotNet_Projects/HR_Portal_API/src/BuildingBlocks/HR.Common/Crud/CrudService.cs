using System.Linq.Expressions;
using HR.Common.Cache;
using HR.Common.Common;
using HR.Common.Data;
using Mapster;
using Microsoft.EntityFrameworkCore;

namespace HR.Common.Crud;

/// <summary>Implemented by generated request DTOs: applies database column defaults for properties the client left out on create.</summary>
public interface IHasCreateDefaults<in TEntity> { void ApplyCreateDefaults(TEntity entity); }

public interface ICrudService<TReq, TDto>
{
    Task<PagedResult<TDto>> ListAsync(PageQuery q, CancellationToken ct);
    Task<TDto> GetAsync(string id, CancellationToken ct);
    Task<TDto> CreateAsync(TReq req, CancellationToken ct);
    Task<TDto> UpdateAsync(string id, TReq req, CancellationToken ct);
    Task DeleteAsync(string id, CancellationToken ct);
}

/// <summary>
/// Reusable service for reference/master data (departments, leave types, shifts, salary components ...): paging, allow-listed sorting,
/// escaped LIKE search, Mapster mapping (entity never leaves the service), audit trail, soft delete and cache eviction.
/// Business rules are added by overriding the hooks.
/// </summary>
public abstract class CrudService<TEntity, TReq, TDto>(DbContext db, IAuditWriter audit, ICacheService cache) : ICrudService<TReq, TDto> where TEntity : class, new()
{
    protected abstract string Label { get; }
    protected abstract string[] SortFields { get; }
    protected abstract string DefaultSort { get; }
    /// <summary>Columns (CLR property names) matched by the free-text search.</summary>
    protected virtual string[] SearchFields => [];
    protected virtual string? CachePrefix => null;
    protected virtual IQueryable<TEntity> Filter(IQueryable<TEntity> q, PageQuery pq) => q;
    protected virtual Task BeforeCreateAsync(TEntity e, TReq req, CancellationToken ct) => Task.CompletedTask;
    protected virtual Task BeforeUpdateAsync(TEntity e, TReq req, CancellationToken ct) => Task.CompletedTask;
    protected virtual Task BeforeDeleteAsync(TEntity e, CancellationToken ct) => Task.CompletedTask;
    protected virtual Task AfterChangeAsync(TEntity e, string action, CancellationToken ct) => Task.CompletedTask;

    private IUnitOfWork? _uow;
    private IUnitOfWork Uow => _uow ??= new UnitOfWork(db);   // execution-strategy-aware transaction (retry-safe)

    private static string IdOf(TEntity e) => (string)typeof(TEntity).GetProperty("Id")!.GetValue(e)!;

    public async Task<PagedResult<TDto>> ListAsync(PageQuery pq, CancellationToken ct)
    {
        var q = Filter(db.Set<TEntity>().AsNoTracking(), pq);
        if (!string.IsNullOrWhiteSpace(pq.Search) && SearchFields.Length > 0) q = q.Where(SearchPredicate($"%{pq.Search.Trim().EscapeLike()}%"));
        q = q.OrderByAllowed(pq.Sort, pq.Descending, SortFields, DefaultSort);
        var total = await q.LongCountAsync(ct);
        var rows = await q.Skip((pq.Page - 1) * pq.Size).Take(pq.Size).ToListAsync(ct);
        return PagedResult<TDto>.Of(rows.Adapt<List<TDto>>(), pq.Page, pq.Size, total);
    }

    /// <summary>OR of EF.Functions.Like over the SearchFields, built as an expression tree (translated to SQL, fully parameterised).</summary>
    private Expression<Func<TEntity, bool>> SearchPredicate(string like)
    {
        var p = Expression.Parameter(typeof(TEntity), "e");
        var likeMethod = typeof(DbFunctionsExtensions).GetMethod(nameof(DbFunctionsExtensions.Like), [typeof(DbFunctions), typeof(string), typeof(string)])!;
        Expression? body = null;
        foreach (var f in SearchFields)
        {
            var prop = Expression.Property(p, f);
            var call = Expression.Call(likeMethod, Expression.Constant(EF.Functions), prop, Expression.Constant(like));
            body = body is null ? call : Expression.OrElse(body, call);
        }
        return Expression.Lambda<Func<TEntity, bool>>(body!, p);
    }

    public async Task<TDto> GetAsync(string id, CancellationToken ct)
    {
        var e = await db.Set<TEntity>().AsNoTracking().FirstOrDefaultAsync(x => EF.Property<string>(x, "Id") == id, ct) ?? throw new NotFoundException($"{Label} not found");
        return e.Adapt<TDto>();
    }

    public async Task<TDto> CreateAsync(TReq req, CancellationToken ct)
    {
        var e = req.Adapt<TEntity>();
        if (req is IHasCreateDefaults<TEntity> d) d.ApplyCreateDefaults(e);
        await BeforeCreateAsync(e, req, ct);
        await Uow.ExecuteAsync(async () =>
        {
            db.Set<TEntity>().Add(e);
            await db.SaveChangesAsync(ct);
            await audit.WriteAsync(Label, IdOf(e), "CREATED", null, req);
            await AfterChangeAsync(e, "CREATED", ct);
        }, ct);
        await EvictAsync();
        return e.Adapt<TDto>();
    }

    public async Task<TDto> UpdateAsync(string id, TReq req, CancellationToken ct)
    {
        var e = await db.Set<TEntity>().FirstOrDefaultAsync(x => EF.Property<string>(x, "Id") == id, ct) ?? throw new NotFoundException($"{Label} not found");
        var before = e.Adapt<TDto>();
        req.Adapt(e);
        await BeforeUpdateAsync(e, req, ct);
        await Uow.ExecuteAsync(async () =>
        {
            await db.SaveChangesAsync(ct);
            await audit.WriteAsync(Label, id, "UPDATED", before, e.Adapt<TDto>());
            await AfterChangeAsync(e, "UPDATED", ct);
        }, ct);
        await EvictAsync();
        return e.Adapt<TDto>();
    }

    public async Task DeleteAsync(string id, CancellationToken ct)
    {
        var e = await db.Set<TEntity>().FirstOrDefaultAsync(x => EF.Property<string>(x, "Id") == id, ct) ?? throw new NotFoundException($"{Label} not found");
        await BeforeDeleteAsync(e, ct);
        await Uow.ExecuteAsync(async () =>
        {
            var t = typeof(TEntity);
            if (t.GetProperty("Deleted") is { } del && del.PropertyType == typeof(bool))
            {
                del.SetValue(e, true);
                t.GetProperty("DeletedAt")?.SetValue(e, DateTime.UtcNow);
            }
            else db.Set<TEntity>().Remove(e);
            await db.SaveChangesAsync(ct);
            await audit.WriteAsync(Label, id, "DELETED");
            await AfterChangeAsync(e, "DELETED", ct);
        }, ct);
        await EvictAsync();
    }

    private Task EvictAsync() => CachePrefix is null ? Task.CompletedTask : cache.EvictPrefixAsync(CachePrefix);
}
