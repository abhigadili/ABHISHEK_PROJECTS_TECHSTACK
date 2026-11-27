using StudentMgmt.BuildingBlocks.Common.Repositories;
using StudentMgmt.CourseService.Persistence;
using StudentMgmt.CourseService.Repositories;
using StudentMgmt.CourseService.Repositories.Interfaces;

namespace StudentMgmt.CourseService.UnitOfWork;

public class CourseUnitOfWork : UnitOfWorkBase, ICourseUnitOfWork
{
    public CourseUnitOfWork(CourseDbContext context) : base(context)
    {
        Courses = new CourseRepository(context);
    }

    public ICourseRepository Courses { get; }
}
