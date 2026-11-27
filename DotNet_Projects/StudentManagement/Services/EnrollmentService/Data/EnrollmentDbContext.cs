using EnrollmentService.Entities;
using Microsoft.EntityFrameworkCore;

namespace EnrollmentService.Data;

public class EnrollmentDbContext(DbContextOptions<EnrollmentDbContext> options) : DbContext(options)
{
    public DbSet<Enrollment> Enrollments => Set<Enrollment>();
    public DbSet<SagaInstance> Sagas => Set<SagaInstance>();
    public DbSet<OutboxMessage> Outbox => Set<OutboxMessage>();

    protected override void OnModelCreating(ModelBuilder b) => b.ApplyConfigurationsFromAssembly(typeof(EnrollmentDbContext).Assembly);

    public override Task<int> SaveChangesAsync(CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        foreach (var e in ChangeTracker.Entries())
        {
            switch (e.Entity)
            {
                case Enrollment x: if (e.State == EntityState.Added) { x.CreatedAt = x.UpdatedAt = now; if (x.EnrollmentDate == default) x.EnrollmentDate = now; } else if (e.State == EntityState.Modified) { x.UpdatedAt = now; x.Version++; } break;
                case SagaInstance s: if (e.State == EntityState.Added) s.CreatedAt = s.UpdatedAt = now; else if (e.State == EntityState.Modified) { s.UpdatedAt = now; s.Version++; } break;
                case OutboxMessage o when e.State == EntityState.Added: o.CreatedAt = now; if (o.NextAttemptAt == default) o.NextAttemptAt = now; break;
            }
        }
        return base.SaveChangesAsync(ct);
    }
}
