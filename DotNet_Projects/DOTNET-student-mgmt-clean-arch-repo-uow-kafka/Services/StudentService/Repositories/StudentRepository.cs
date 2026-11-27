using Microsoft.EntityFrameworkCore;
using StudentMgmt.BuildingBlocks.Common.Repositories;
using StudentMgmt.StudentService.Entities;
using StudentMgmt.StudentService.Persistence;
using StudentMgmt.StudentService.Repositories.Interfaces;

namespace StudentMgmt.StudentService.Repositories;

public class StudentRepository : RepositoryBase<Student>, IStudentRepository
{
    public StudentRepository(StudentDbContext context) : base(context) { }

    public async Task<Student?> GetByEmailAsync(string email, CancellationToken cancellationToken = default) =>
        await DbSet.FirstOrDefaultAsync(s => s.Email == email && !s.IsDeleted, cancellationToken);

    public async Task<bool> EmailExistsAsync(string email, CancellationToken cancellationToken = default) =>
        await DbSet.AnyAsync(s => s.Email == email && !s.IsDeleted, cancellationToken);

    public override void Update(Student entity)
    {
        entity.RowVersion = Guid.NewGuid().ToByteArray();
        base.Update(entity);
    }

    public override void Remove(Student entity)
    {
        entity.RowVersion = Guid.NewGuid().ToByteArray();
        base.Remove(entity);
    }
}
