namespace StudentMgmt.EnrollmentService.Services.Interfaces;

/// <summary>
/// Keeps the local StudentSnapshot/CourseSnapshot read models in sync with the
/// events published by StudentService/CourseService. Called from the Kafka
/// consumers' own DI scope (never from an HTTP request), so each method commits
/// its own unit of work rather than relying on a caller to do it.
/// </summary>
public interface ISnapshotSyncService
{
    Task UpsertStudentSnapshotAsync(Guid studentId, string fullName, string email, CancellationToken cancellationToken = default);

    Task RemoveStudentSnapshotAsync(Guid studentId, CancellationToken cancellationToken = default);

    Task UpsertCourseSnapshotAsync(Guid courseId, string title, int capacity, CancellationToken cancellationToken = default);

    Task RemoveCourseSnapshotAsync(Guid courseId, CancellationToken cancellationToken = default);
}
