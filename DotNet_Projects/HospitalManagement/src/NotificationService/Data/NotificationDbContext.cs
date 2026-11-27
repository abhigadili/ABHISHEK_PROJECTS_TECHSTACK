using HMS.Notifications.Domain;
using HMS.Shared.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace HMS.Notifications.Data;

/// <summary>NotificationDB is shared with other applications' tables, so everything of this project is prefixed "hdn_" and nothing else is touched.</summary>
public class NotificationDbContext(DbContextOptions<NotificationDbContext> options) : ServiceDbContext(options)
{
    public DbSet<Notification> Notifications => Set<Notification>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);
        b.Entity<Notification>(e =>
        {
            e.ToTable("hdn_notifications");
            e.Property(x => x.RecipientEmail).HasMaxLength(120).IsRequired();
            e.Property(x => x.RecipientPhone).HasMaxLength(20);
            e.Property(x => x.Channel).HasConversion<string>().HasMaxLength(6);
            e.Property(x => x.Subject).HasMaxLength(200).IsRequired();
            e.Property(x => x.Message).HasMaxLength(2000).IsRequired();
            e.Property(x => x.EventType).HasMaxLength(40).IsRequired();
            e.Property(x => x.ReferenceId).HasMaxLength(40);
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(8);
            e.Property(x => x.FailureReason).HasMaxLength(255);
            e.HasIndex(x => new { x.RecipientEmail, x.CreatedAt }).HasDatabaseName("idx_notification_recipient");
            e.HasIndex(x => new { x.EventType, x.ReferenceId }).HasDatabaseName("idx_notification_event");
            e.HasIndex(x => new { x.Status, x.Id }).HasDatabaseName("idx_notification_status");
        });
    }
}

public class NotificationDbContextFactory : IDesignTimeDbContextFactory<NotificationDbContext>
{
    public NotificationDbContext CreateDbContext(string[] args)
    {
        var o = new DbContextOptionsBuilder<NotificationDbContext>();
        DbConnection.ConfigureDesignTime(o);
        return new NotificationDbContext(o.Options);
    }
}
