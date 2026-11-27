using Microsoft.EntityFrameworkCore;
using NotificationService.Entities;

namespace NotificationService.Data;

public class NotificationDbContext(DbContextOptions<NotificationDbContext> options) : DbContext(options)
{
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<InboxMessage> InboxMessages => Set<InboxMessage>();

    protected override void OnModelCreating(ModelBuilder b) => b.ApplyConfigurationsFromAssembly(typeof(NotificationDbContext).Assembly);

    public override Task<int> SaveChangesAsync(CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        foreach (var e in ChangeTracker.Entries().Where(e => e.State == EntityState.Added))
        {
            if (e.Entity is Notification n) n.CreatedAt = now;
            else if (e.Entity is InboxMessage m) m.ReceivedAt = now;
        }
        return base.SaveChangesAsync(ct);
    }
}
