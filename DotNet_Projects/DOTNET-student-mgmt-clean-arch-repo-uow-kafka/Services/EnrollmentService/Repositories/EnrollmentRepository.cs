using Microsoft.EntityFrameworkCore;
using StudentMgmt.BuildingBlocks.Common.Repositories;
using StudentMgmt.EnrollmentService.Entities;
using StudentMgmt.EnrollmentService.Repositories.Interfaces;

namespace StudentMgmt.EnrollmentService.Repositories;

public class EnrollmentRepository : RepositoryBase<Enrollment>, IEnrollmentRepository
{
    public EnrollmentRepository(DbContext context) : base(context)
    {
    }

    public async Task<IReadOnlyList<Enrollment>> GetByStudentIdAsync(Guid studentId, CancellationToken cancellationToken = default) =>
        await DbSet
            .Where(e => !e.IsDeleted && e.StudentId == studentId)
            .OrderByDescending(e => e.EnrolledOnUtc)
            .ToListAsync(cancellationToken);

    public async Task<bool> HasActiveEnrollmentAsync(Guid studentId, Guid courseId, CancellationToken cancellationToken = default) =>
        await DbSet.AnyAsync(
            e => !e.IsDeleted && e.StudentId == studentId && e.CourseId == courseId && e.Status != EnrollmentStatus.Cancelled,
            cancellationToken);
}
