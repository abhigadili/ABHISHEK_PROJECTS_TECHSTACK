using StudentMgmt.BuildingBlocks.Common.Repositories;
using StudentMgmt.CourseService.Entities;

namespace StudentMgmt.CourseService.Repositories.Interfaces;

public interface ICourseRepository : IRepository<Course>
{
    Task<Course?> GetByCourseCodeAsync(string courseCode, CancellationToken cancellationToken = default);

    Task<bool> CourseCodeExistsAsync(string courseCode, CancellationToken cancellationToken = default);
}
