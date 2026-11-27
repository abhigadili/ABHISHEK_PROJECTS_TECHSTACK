namespace StudentMgmt.BuildingBlocks.Common.Repositories;

/// <summary>
/// Base Unit of Work contract. Each service defines its own
/// I{Service}UnitOfWork (e.g. IStudentUnitOfWork) that extends this and exposes
/// its specific repositories (Students, Users, RefreshTokens, ...) as properties,
/// so a controller/application-service commits every repository change made
/// during one request in a single database transaction.
/// </summary>
public interface IUnitOfWork : IDisposable
{
    /// <summary>Persists every tracked change via a single SaveChanges call.</summary>
    Task<int> CommitAsync(CancellationToken cancellationToken = default);

    Task BeginTransactionAsync(CancellationToken cancellationToken = default);

    Task CommitTransactionAsync(CancellationToken cancellationToken = default);

    Task RollbackTransactionAsync(CancellationToken cancellationToken = default);
}
