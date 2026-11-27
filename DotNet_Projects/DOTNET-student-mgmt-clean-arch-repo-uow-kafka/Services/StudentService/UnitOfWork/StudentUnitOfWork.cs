using StudentMgmt.BuildingBlocks.Common.Repositories;
using StudentMgmt.StudentService.Persistence;
using StudentMgmt.StudentService.Repositories;
using StudentMgmt.StudentService.Repositories.Interfaces;

namespace StudentMgmt.StudentService.UnitOfWork;

public class StudentUnitOfWork : UnitOfWorkBase, IStudentUnitOfWork
{
    public StudentUnitOfWork(StudentDbContext context) : base(context)
    {
        Students = new StudentRepository(context);
        Users = new UserRepository(context);
        Roles = new RoleRepository(context);
        RefreshTokens = new RefreshTokenRepository(context);
    }

    public IStudentRepository Students { get; }
    public IUserRepository Users { get; }
    public IRoleRepository Roles { get; }
    public IRefreshTokenRepository RefreshTokens { get; }
}
