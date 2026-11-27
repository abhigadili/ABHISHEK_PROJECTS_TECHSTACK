using System.Linq.Expressions;
using HR.Common.Common;
using Microsoft.EntityFrameworkCore;

namespace HR.Common.Data;

/// <summary>Generic repository over a DbContext (Repository pattern). Writes are staged; the UnitOfWork commits.</summary>
public interface IRepository<T> where T : class
{
    IQueryable<T> Query();
    IQueryable<T> QueryNoTracking();
    ValueTask<T?> FindAsync(object id, CancellationToken ct = default);
    Task<T> GetAsync(object id, CancellationToken ct = default);
    Task<T?> FirstOrDefaultAsync(Expression<Func<T, bool>> predicate, CancellationToken ct = default);
    Task<bool> AnyAsync(Expression<Func<T, bool>> predicate, CancellationToken ct = default);
    Task AddAsync(T entity, CancellationToken ct = default);
    Task AddRangeAsync(IEnumerable<T> entities, CancellationToken ct = default);
    void Remove(T entity);
}

public sealed class EfRepository<T>(DbContext db) : IRepository<T> where T : class
{
    public IQueryable<T> Query() => db.Set<T>();
    public IQueryable<T> QueryNoTracking() => db.Set<T>().AsNoTracking();
    public ValueTask<T?> FindAsync(object id, CancellationToken ct = default) => db.Set<T>().FindAsync([id], ct);
    public async Task<T> GetAsync(object id, CancellationToken ct = default) =>
        await db.Set<T>().FindAsync([id], ct) ?? throw new NotFoundException($"{typeof(T).Name} '{id}' was not found");
    public Task<T?> FirstOrDefaultAsync(Expression<Func<T, bool>> predicate, CancellationToken ct = default) => db.Set<T>().FirstOrDefaultAsync(predicate, ct);
    public Task<bool> AnyAsync(Expression<Func<T, bool>> predicate, CancellationToken ct = default) => db.Set<T>().AnyAsync(predicate, ct);
    public async Task AddAsync(T entity, CancellationToken ct = default) => await db.Set<T>().AddAsync(entity, ct);
    public Task AddRangeAsync(IEnumerable<T> entities, CancellationToken ct = default) => db.Set<T>().AddRangeAsync(entities, ct);
    public void Remove(T entity) => db.Set<T>().Remove(entity);
}

/// <summary>Unit of Work: one SaveChanges / one DB transaction per business operation (entity changes + audit + outbox events together).</summary>
public interface IUnitOfWork
{
    Task<int> SaveChangesAsync(CancellationToken ct = default);
    /// <summary>Runs the work inside a single DB transaction (wrapped by the EF execution strategy); joins an ambient transaction when one exists.</summary>
    Task ExecuteAsync(Func<Task> work, CancellationToken ct = default);
    Task<T> ExecuteAsync<T>(Func<Task<T>> work, CancellationToken ct = default);
}

public sealed class UnitOfWork(DbContext db) : IUnitOfWork
{
    public Task<int> SaveChangesAsync(CancellationToken ct = default) => db.SaveChangesAsync(ct);

    public Task ExecuteAsync(Func<Task> work, CancellationToken ct = default) => ExecuteAsync<object?>(async () => { await work(); return null; }, ct);

    public async Task<T> ExecuteAsync<T>(Func<Task<T>> work, CancellationToken ct = default)
    {
        if (db.Database.CurrentTransaction is not null) return await work();
        T result = default!;
        var strategy = db.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            result = await work();
            await tx.CommitAsync(ct);
        });
        return result;
    }
}
