using StudentMgmt.BuildingBlocks.Common.Repositories;
using StudentMgmt.CourseService.Repositories.Interfaces;

namespace StudentMgmt.CourseService.UnitOfWork;

public interface ICourseUnitOfWork : IUnitOfWork
{
    ICourseRepository Courses { get; }
}
