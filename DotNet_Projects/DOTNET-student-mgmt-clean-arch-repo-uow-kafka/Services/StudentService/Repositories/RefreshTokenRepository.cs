using Microsoft.EntityFrameworkCore;
using StudentMgmt.BuildingBlocks.Common.Repositories;
using StudentMgmt.StudentService.Entities;
using StudentMgmt.StudentService.Persistence;
using StudentMgmt.StudentService.Repositories.Interfaces;

namespace StudentMgmt.StudentService.Repositories;

public class RefreshTokenRepository : RepositoryBase<RefreshToken>, IRefreshTokenRepository
{
    public RefreshTokenRepository(StudentDbContext context) : base(context) { }

    public async Task<RefreshToken?> GetByTokenValueAsync(string token, CancellationToken cancellationToken = default) =>
        await DbSet.FirstOrDefaultAsync(rt => rt.Token == token && !rt.IsDeleted, cancellationToken);

    public override void Update(RefreshToken entity)
    {
        entity.RowVersion = Guid.NewGuid().ToByteArray();
        base.Update(entity);
    }

    public override void Remove(RefreshToken entity)
    {
        entity.RowVersion = Guid.NewGuid().ToByteArray();
        base.Remove(entity);
    }
}
