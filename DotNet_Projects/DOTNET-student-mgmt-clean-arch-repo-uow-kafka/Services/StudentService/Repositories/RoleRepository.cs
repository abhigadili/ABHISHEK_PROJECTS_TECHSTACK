using Microsoft.EntityFrameworkCore;
using StudentMgmt.BuildingBlocks.Common.Repositories;
using StudentMgmt.StudentService.Entities;
using StudentMgmt.StudentService.Persistence;
using StudentMgmt.StudentService.Repositories.Interfaces;

namespace StudentMgmt.StudentService.Repositories;

public class RoleRepository : RepositoryBase<Role>, IRoleRepository
{
    public RoleRepository(StudentDbContext context) : base(context) { }

    public async Task<Role?> GetByNameAsync(string name, CancellationToken cancellationToken = default) =>
        await DbSet.FirstOrDefaultAsync(r => r.Name == name && !r.IsDeleted, cancellationToken);

    public override void Update(Role entity)
    {
        entity.RowVersion = Guid.NewGuid().ToByteArray();
        base.Update(entity);
    }

    public override void Remove(Role entity)
    {
        entity.RowVersion = Guid.NewGuid().ToByteArray();
        base.Remove(entity);
    }
}
