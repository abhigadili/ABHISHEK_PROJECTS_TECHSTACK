using CourseService.Entities;
using Microsoft.EntityFrameworkCore;

namespace CourseService.Data;

public class CourseDbContext(DbContextOptions<CourseDbContext> options) : DbContext(options)
{
    public DbSet<CourseCategory> Categories => Set<CourseCategory>();
    public DbSet<Course> Courses => Set<Course>();
    public DbSet<SeatReservation> Reservations => Set<SeatReservation>();

    protected override void OnModelCreating(ModelBuilder b) => b.ApplyConfigurationsFromAssembly(typeof(CourseDbContext).Assembly);

    public override Task<int> SaveChangesAsync(CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        foreach (var e in ChangeTracker.Entries())
        {
            if (e.Entity is Course c) { if (e.State == EntityState.Added) c.CreatedAt = c.UpdatedAt = now; else if (e.State == EntityState.Modified) c.UpdatedAt = now; }
            else if (e.Entity is CourseCategory k && e.State == EntityState.Added) k.CreatedAt = now;
            else if (e.Entity is SeatReservation r) { if (e.State == EntityState.Added) r.CreatedAt = r.UpdatedAt = now; else if (e.State == EntityState.Modified) r.UpdatedAt = now; }
        }
        return base.SaveChangesAsync(ct);
    }
}
