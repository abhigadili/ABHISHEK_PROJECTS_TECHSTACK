using StudentMgmt.BuildingBlocks.Common.Repositories;
using StudentMgmt.EnrollmentService.Persistence;
using StudentMgmt.EnrollmentService.Repositories;
using StudentMgmt.EnrollmentService.Repositories.Interfaces;

namespace StudentMgmt.EnrollmentService.UnitOfWork;

public class EnrollmentUnitOfWork : UnitOfWorkBase, IEnrollmentUnitOfWork
{
    public EnrollmentUnitOfWork(EnrollmentDbContext context) : base(context)
    {
        Enrollments = new EnrollmentRepository(context);
        StudentSnapshots = new StudentSnapshotRepository(context);
        CourseSnapshots = new CourseSnapshotRepository(context);
    }

    public IEnrollmentRepository Enrollments { get; }
    public IStudentSnapshotRepository StudentSnapshots { get; }
    public ICourseSnapshotRepository CourseSnapshots { get; }
}
