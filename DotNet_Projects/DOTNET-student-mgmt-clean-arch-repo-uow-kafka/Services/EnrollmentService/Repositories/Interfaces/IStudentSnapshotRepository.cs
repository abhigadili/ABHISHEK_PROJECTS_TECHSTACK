using StudentMgmt.BuildingBlocks.Common.Repositories;
using StudentMgmt.EnrollmentService.Entities;

namespace StudentMgmt.EnrollmentService.Repositories.Interfaces;

public interface IStudentSnapshotRepository : IRepository<StudentSnapshot>
{
    /// <summary>Inserts a new snapshot, or updates the existing one in place, keyed by <paramref name="studentId"/>.</summary>
    Task UpsertAsync(Guid studentId, string fullName, string email, CancellationToken cancellationToken = default);
}
