using Microsoft.EntityFrameworkCore;
using StudentMgmt.BuildingBlocks.Common.Repositories;
using StudentMgmt.StudentService.Entities;
using StudentMgmt.StudentService.Persistence;
using StudentMgmt.StudentService.Repositories.Interfaces;

namespace StudentMgmt.StudentService.Repositories;

public class UserRepository : RepositoryBase<ApplicationUser>, IUserRepository
{
    private readonly StudentDbContext _dbContext;

    public UserRepository(StudentDbContext context) : base(context)
    {
        _dbContext = context;
    }

    public async Task<ApplicationUser?> GetByEmailAsync(string email, CancellationToken cancellationToken = default) =>
        await DbSet.FirstOrDefaultAsync(u => u.Email == email && !u.IsDeleted, cancellationToken);

    public async Task<bool> EmailExistsAsync(string email, CancellationToken cancellationToken = default) =>
        await DbSet.AnyAsync(u => u.Email == email && !u.IsDeleted, cancellationToken);

    public async Task<(ApplicationUser User, IReadOnlyList<string> Roles)?> GetByEmailWithRolesAsync(string email, CancellationToken cancellationToken = default)
    {
        var user = await DbSet.FirstOrDefaultAsync(u => u.Email == email && !u.IsDeleted, cancellationToken);
        if (user is null)
        {
            return null;
        }

        var roles = await GetRoleNamesForUserAsync(user.Id, cancellationToken);
        return (user, roles);
    }

    public async Task<IReadOnlyList<string>> GetRoleNamesForUserAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await (
            from userRole in _dbContext.UserRoles
            join role in _dbContext.Roles on userRole.RoleId equals role.Id
            where userRole.UserId == userId && !userRole.IsDeleted && !role.IsDeleted
            select role.Name
        ).ToListAsync(cancellationToken);
    }

    public async Task AssignRoleAsync(Guid userId, Guid roleId, CancellationToken cancellationToken = default)
    {
        await _dbContext.UserRoles.AddAsync(new UserRole { UserId = userId, RoleId = roleId }, cancellationToken);
    }

    public override void Update(ApplicationUser entity)
    {
        entity.RowVersion = Guid.NewGuid().ToByteArray();
        base.Update(entity);
    }

    public override void Remove(ApplicationUser entity)
    {
        entity.RowVersion = Guid.NewGuid().ToByteArray();
        base.Remove(entity);
    }
}
