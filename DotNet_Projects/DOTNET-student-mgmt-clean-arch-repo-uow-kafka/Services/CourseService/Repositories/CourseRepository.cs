using Microsoft.EntityFrameworkCore;
using StudentMgmt.BuildingBlocks.Common.Repositories;
using StudentMgmt.CourseService.Entities;
using StudentMgmt.CourseService.Persistence;
using StudentMgmt.CourseService.Repositories.Interfaces;

namespace StudentMgmt.CourseService.Repositories;

public class CourseRepository : RepositoryBase<Course>, ICourseRepository
{
    public CourseRepository(CourseDbContext context) : base(context)
    {
    }

    public async Task<Course?> GetByCourseCodeAsync(string courseCode, CancellationToken cancellationToken = default) =>
        await DbSet.FirstOrDefaultAsync(c => c.CourseCode == courseCode && !c.IsDeleted, cancellationToken);

    public async Task<bool> CourseCodeExistsAsync(string courseCode, CancellationToken cancellationToken = default) =>
        await DbSet.AnyAsync(c => c.CourseCode == courseCode && !c.IsDeleted, cancellationToken);

    /// <summary>
    /// MySQL has no native rowversion/timestamp column type, so unlike SQL
    /// Server this concurrency token has to be assigned a fresh value by hand on
    /// every update instead of being generated automatically by the database.
    /// </summary>
    public override void Update(Course entity)
    {
        entity.RowVersion = Guid.NewGuid().ToByteArray();
        base.Update(entity);
    }
}
