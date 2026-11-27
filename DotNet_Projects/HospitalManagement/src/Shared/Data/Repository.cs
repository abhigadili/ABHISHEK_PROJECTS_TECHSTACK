using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;

namespace HMS.Shared.Data;

/// <summary>Generic repository over the owning service's DbContext (one aggregate type per instance).</summary>
public interface IRepository<T> where T : class
{
    IQueryable<T> Query();
    Task<T?> GetAsync(long id, CancellationToken ct = default);
    Task<bool> AnyAsync(Expression<Func<T, bool>> predicate, CancellationToken ct = default);
    Task<T?> FirstOrDefaultAsync(Expression<Func<T, bool>> predicate, CancellationToken ct = default);
    Task<List<T>> ListAsync(Expression<Func<T, bool>>? predicate = null, CancellationToken ct = default);
    Task AddAsync(T entity, CancellationToken ct = default);
    void Remove(T entity);
    Task<int> SaveAsync(CancellationToken ct = default);
}

public sealed class EfRepository<T>(DbContext db) : IRepository<T> where T : class
{
    public IQueryable<T> Query() => db.Set<T>();
    public async Task<T?> GetAsync(long id, CancellationToken ct = default) => await db.Set<T>().FindAsync([id], ct);
    public Task<bool> AnyAsync(Expression<Func<T, bool>> predicate, CancellationToken ct = default) => db.Set<T>().AnyAsync(predicate, ct);
    public Task<T?> FirstOrDefaultAsync(Expression<Func<T, bool>> predicate, CancellationToken ct = default) => db.Set<T>().FirstOrDefaultAsync(predicate, ct);
    public Task<List<T>> ListAsync(Expression<Func<T, bool>>? predicate = null, CancellationToken ct = default)
        => (predicate is null ? db.Set<T>() : db.Set<T>().Where(predicate)).ToListAsync(ct);
    public async Task AddAsync(T entity, CancellationToken ct = default) => await db.Set<T>().AddAsync(entity, ct);
    public void Remove(T entity) => db.Set<T>().Remove(entity);
    public Task<int> SaveAsync(CancellationToken ct = default) => db.SaveChangesAsync(ct);
}
