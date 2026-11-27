using StudentMgmt.BuildingBlocks.Common.Repositories;
using StudentMgmt.StudentService.Repositories.Interfaces;

namespace StudentMgmt.StudentService.UnitOfWork;

public interface IStudentUnitOfWork : IUnitOfWork
{
    IStudentRepository Students { get; }
    IUserRepository Users { get; }
    IRoleRepository Roles { get; }
    IRefreshTokenRepository RefreshTokens { get; }
}
