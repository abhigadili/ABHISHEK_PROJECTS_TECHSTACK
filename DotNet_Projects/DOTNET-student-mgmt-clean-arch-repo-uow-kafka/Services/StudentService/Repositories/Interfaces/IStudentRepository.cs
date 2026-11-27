using StudentMgmt.BuildingBlocks.Common.Repositories;
using StudentMgmt.StudentService.Entities;

namespace StudentMgmt.StudentService.Repositories.Interfaces;

public interface IStudentRepository : IRepository<Student>
{
    Task<Student?> GetByEmailAsync(string email, CancellationToken cancellationToken = default);

    Task<bool> EmailExistsAsync(string email, CancellationToken cancellationToken = default);
}
