using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using StudentMgmt.BuildingBlocks.Common.Entities;

namespace StudentMgmt.BuildingBlocks.Common.Repositories;

/// <summary>
/// Generic EF Core implementation of <see cref="IRepository{TEntity}"/>. Every
/// entity-specific repository (StudentRepository, CourseRepository, ...) derives
/// from this and only adds the queries genuinely specific to that entity, instead
/// of re-implementing CRUD + paging + soft delete each time.
/// </summary>
public abstract class RepositoryBase<TEntity> : IRepository<TEntity> where TEntity : BaseEntity
{
    protected readonly DbContext Context;
    protected readonly DbSet<TEntity> DbSet;

    protected RepositoryBase(DbContext context)
    {
        Context = context;
        DbSet = context.Set<TEntity>();
    }

    public virtual async Task<TEntity?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        await DbSet.FirstOrDefaultAsync(e => e.Id == id && !e.IsDeleted, cancellationToken);

    public virtual async Task<IReadOnlyList<TEntity>> GetAllAsync(CancellationToken cancellationToken = default) =>
        await DbSet.Where(e => !e.IsDeleted).ToListAsync(cancellationToken);

    public virtual async Task<IReadOnlyList<TEntity>> FindAsync(Expression<Func<TEntity, bool>> predicate, CancellationToken cancellationToken = default) =>
        await DbSet.Where(e => !e.IsDeleted).Where(predicate).ToListAsync(cancellationToken);

    public virtual async Task<(IReadOnlyList<TEntity> Items, int TotalCount)> GetPagedAsync(
        int pageNumber,
        int pageSize,
        Expression<Func<TEntity, bool>>? filter = null,
        Func<IQueryable<TEntity>, IOrderedQueryable<TEntity>>? orderBy = null,
        CancellationToken cancellationToken = default)
    {
        IQueryable<TEntity> query = DbSet.Where(e => !e.IsDeleted);

        if (filter is not null)
        {
            query = query.Where(filter);
        }

        var totalCount = await query.CountAsync(cancellationToken);

        query = orderBy is not null ? orderBy(query) : query.OrderByDescending(e => e.CreatedDate);

        var items = await query
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return (items, totalCount);
    }

    public virtual async Task<bool> ExistsAsync(Expression<Func<TEntity, bool>> predicate, CancellationToken cancellationToken = default) =>
        await DbSet.Where(e => !e.IsDeleted).AnyAsync(predicate, cancellationToken);

    public virtual async Task AddAsync(TEntity entity, CancellationToken cancellationToken = default) =>
        await DbSet.AddAsync(entity, cancellationToken);

    public virtual void Update(TEntity entity)
    {
        entity.UpdatedDate = DateTime.UtcNow;
        DbSet.Update(entity);
    }

    public virtual void Remove(TEntity entity)
    {
        entity.IsDeleted = true;
        entity.DeletedDate = DateTime.UtcNow;
        DbSet.Update(entity);
    }
}
