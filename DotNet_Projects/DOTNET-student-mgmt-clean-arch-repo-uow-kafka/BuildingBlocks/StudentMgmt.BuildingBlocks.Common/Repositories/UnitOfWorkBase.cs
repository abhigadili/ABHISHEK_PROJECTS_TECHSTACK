using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.EntityFrameworkCore;

namespace StudentMgmt.BuildingBlocks.Common.Repositories;

/// <summary>
/// Implements the transaction/commit/rollback/dispose mechanics of
/// <see cref="IUnitOfWork"/> against a single EF Core <see cref="DbContext"/>.
/// Each service's concrete UnitOfWork (e.g. StudentUnitOfWork) derives from this
/// and adds its repository properties (Students, Users, RefreshTokens, ...).
/// </summary>
public abstract class UnitOfWorkBase : IUnitOfWork
{
    protected readonly DbContext Context;
    private IDbContextTransaction? _currentTransaction;
    private bool _disposed;

    protected UnitOfWorkBase(DbContext context)
    {
        Context = context;
    }

    public async Task<int> CommitAsync(CancellationToken cancellationToken = default) =>
        await Context.SaveChangesAsync(cancellationToken);

    public async Task BeginTransactionAsync(CancellationToken cancellationToken = default)
    {
        _currentTransaction = await Context.Database.BeginTransactionAsync(cancellationToken);
    }

    public async Task CommitTransactionAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            await CommitAsync(cancellationToken);
            if (_currentTransaction is not null)
            {
                await _currentTransaction.CommitAsync(cancellationToken);
            }
        }
        catch
        {
            await RollbackTransactionAsync(cancellationToken);
            throw;
        }
        finally
        {
            if (_currentTransaction is not null)
            {
                await _currentTransaction.DisposeAsync();
                _currentTransaction = null;
            }
        }
    }

    public async Task RollbackTransactionAsync(CancellationToken cancellationToken = default)
    {
        if (_currentTransaction is not null)
        {
            await _currentTransaction.RollbackAsync(cancellationToken);
            await _currentTransaction.DisposeAsync();
            _currentTransaction = null;
        }
    }

    public void Dispose()
    {
        Dispose(true);
        GC.SuppressFinalize(this);
    }

    protected virtual void Dispose(bool disposing)
    {
        if (_disposed)
        {
            return;
        }

        if (disposing)
        {
            _currentTransaction?.Dispose();
            Context.Dispose();
        }

        _disposed = true;
    }
}
