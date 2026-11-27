using StudentMgmt.EnrollmentService.Services.Interfaces;
using StudentMgmt.EnrollmentService.UnitOfWork;

namespace StudentMgmt.EnrollmentService.Services;

public class SnapshotSyncService : ISnapshotSyncService
{
    private readonly IEnrollmentUnitOfWork _unitOfWork;

    public SnapshotSyncService(IEnrollmentUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task UpsertStudentSnapshotAsync(Guid studentId, string fullName, string email, CancellationToken cancellationToken = default)
    {
        await _unitOfWork.StudentSnapshots.UpsertAsync(studentId, fullName, email, cancellationToken);
        await _unitOfWork.CommitAsync(cancellationToken);
    }

    public async Task RemoveStudentSnapshotAsync(Guid studentId, CancellationToken cancellationToken = default)
    {
        var snapshot = await _unitOfWork.StudentSnapshots.GetByIdAsync(studentId, cancellationToken);
        if (snapshot is not null)
        {
            _unitOfWork.StudentSnapshots.Remove(snapshot);
            await _unitOfWork.CommitAsync(cancellationToken);
        }
    }

    public async Task UpsertCourseSnapshotAsync(Guid courseId, string title, int capacity, CancellationToken cancellationToken = default)
    {
        await _unitOfWork.CourseSnapshots.UpsertAsync(courseId, title, capacity, cancellationToken);
        await _unitOfWork.CommitAsync(cancellationToken);
    }

    public async Task RemoveCourseSnapshotAsync(Guid courseId, CancellationToken cancellationToken = default)
    {
        var snapshot = await _unitOfWork.CourseSnapshots.GetByIdAsync(courseId, cancellationToken);
        if (snapshot is not null)
        {
            _unitOfWork.CourseSnapshots.Remove(snapshot);
            await _unitOfWork.CommitAsync(cancellationToken);
        }
    }
}
