using StudentMgmt.BuildingBlocks.Common.Repositories;
using StudentMgmt.EnrollmentService.Entities;

namespace StudentMgmt.EnrollmentService.Repositories.Interfaces;

public interface IEnrollmentRepository : IRepository<Enrollment>
{
    Task<IReadOnlyList<Enrollment>> GetByStudentIdAsync(Guid studentId, CancellationToken cancellationToken = default);

    /// <summary>True if the student has any enrollment for the course whose Status is not Cancelled.</summary>
    Task<bool> HasActiveEnrollmentAsync(Guid studentId, Guid courseId, CancellationToken cancellationToken = default);
}
