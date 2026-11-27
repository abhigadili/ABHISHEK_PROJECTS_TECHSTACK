using StudentMgmt.BuildingBlocks.Common.Repositories;
using StudentMgmt.StudentService.Entities;

namespace StudentMgmt.StudentService.Repositories.Interfaces;

public interface IRefreshTokenRepository : IRepository<RefreshToken>
{
    Task<RefreshToken?> GetByTokenValueAsync(string token, CancellationToken cancellationToken = default);
}
