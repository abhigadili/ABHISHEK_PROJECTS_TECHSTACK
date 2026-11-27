using Microsoft.EntityFrameworkCore;
using StudentMgmt.BuildingBlocks.Common.Repositories;
using StudentMgmt.EnrollmentService.Entities;
using StudentMgmt.EnrollmentService.Repositories.Interfaces;

namespace StudentMgmt.EnrollmentService.Repositories;

public class StudentSnapshotRepository : RepositoryBase<StudentSnapshot>, IStudentSnapshotRepository
{
    public StudentSnapshotRepository(DbContext context) : base(context)
    {
    }

    public async Task UpsertAsync(Guid studentId, string fullName, string email, CancellationToken cancellationToken = default)
    {
        var existing = await GetByIdAsync(studentId, cancellationToken);
        if (existing is not null)
        {
            existing.FullName = fullName;
            existing.Email = email;
            Update(existing);
        }
        else
        {
            var snapshot = new StudentSnapshot
            {
                Id = studentId,
                FullName = fullName,
                Email = email
            };
            await AddAsync(snapshot, cancellationToken);
        }
    }
}
