using System.Linq.Expressions;
using StudentMgmt.BuildingBlocks.Common.Entities;

namespace StudentMgmt.BuildingBlocks.Common.Repositories;

/// <summary>
/// Generic Repository contract shared by every entity-specific repository
/// (IStudentRepository, ICourseRepository, IEnrollmentRepository,
/// INotificationRepository, ...). Entity-specific interfaces extend this and add
/// only the queries that are genuinely specific to that entity
/// (e.g. IStudentRepository.GetByEmailAsync).
/// </summary>
public interface IRepository<TEntity> where TEntity : BaseEntity
{
    Task<TEntity?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<TEntity>> GetAllAsync(CancellationToken cancellationToken = default);

    Task<IReadOnlyList<TEntity>> FindAsync(Expression<Func<TEntity, bool>> predicate, CancellationToken cancellationToken = default);

    Task<(IReadOnlyList<TEntity> Items, int TotalCount)> GetPagedAsync(
        int pageNumber,
        int pageSize,
        Expression<Func<TEntity, bool>>? filter = null,
        Func<IQueryable<TEntity>, IOrderedQueryable<TEntity>>? orderBy = null,
        CancellationToken cancellationToken = default);

    Task<bool> ExistsAsync(Expression<Func<TEntity, bool>> predicate, CancellationToken cancellationToken = default);

    Task AddAsync(TEntity entity, CancellationToken cancellationToken = default);

    void Update(TEntity entity);

    /// <summary>Soft delete — sets IsDeleted/DeletedDate/DeletedBy, never removes the row.</summary>
    void Remove(TEntity entity);
}
