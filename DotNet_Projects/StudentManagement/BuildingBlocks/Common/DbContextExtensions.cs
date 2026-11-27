using Microsoft.EntityFrameworkCore;

namespace Common;

public static class DbContextExtensions
{
    /// <summary>
    /// Runs the delegate in ONE database transaction inside EF's execution strategy (required when EnableRetryOnFailure is on).
    /// The delegate may be re-run on a transient failure, so it must contain only the database work.
    /// </summary>
    public static Task<T> InTransactionAsync<T>(this DbContext db, Func<Task<T>> work, CancellationToken ct = default)
        => db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
        {
            db.ChangeTracker.Clear();
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            var result = await work();
            await tx.CommitAsync(ct);
            return result;
        });
}
