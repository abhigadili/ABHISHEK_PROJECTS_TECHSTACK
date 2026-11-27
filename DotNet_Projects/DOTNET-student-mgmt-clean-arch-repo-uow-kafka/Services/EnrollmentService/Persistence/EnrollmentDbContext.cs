using Microsoft.EntityFrameworkCore;
using StudentMgmt.EnrollmentService.Entities;

namespace StudentMgmt.EnrollmentService.Persistence;

public class EnrollmentDbContext : DbContext
{
    public EnrollmentDbContext(DbContextOptions<EnrollmentDbContext> options) : base(options)
    {
    }

    public DbSet<Enrollment> Enrollments => Set<Enrollment>();
    public DbSet<StudentSnapshot> StudentSnapshots => Set<StudentSnapshot>();
    public DbSet<CourseSnapshot> CourseSnapshots => Set<CourseSnapshot>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(EnrollmentDbContext).Assembly);
    }
}
