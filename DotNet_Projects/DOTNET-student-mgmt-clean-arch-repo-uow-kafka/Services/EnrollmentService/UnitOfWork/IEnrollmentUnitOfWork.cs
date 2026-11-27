using StudentMgmt.BuildingBlocks.Common.Repositories;
using StudentMgmt.EnrollmentService.Repositories.Interfaces;

namespace StudentMgmt.EnrollmentService.UnitOfWork;

public interface IEnrollmentUnitOfWork : IUnitOfWork
{
    IEnrollmentRepository Enrollments { get; }
    IStudentSnapshotRepository StudentSnapshots { get; }
    ICourseSnapshotRepository CourseSnapshots { get; }
}
