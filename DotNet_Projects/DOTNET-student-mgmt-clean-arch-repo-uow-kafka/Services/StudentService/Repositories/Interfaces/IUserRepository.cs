using StudentMgmt.BuildingBlocks.Common.Repositories;
using StudentMgmt.StudentService.Entities;

namespace StudentMgmt.StudentService.Repositories.Interfaces;

public interface IUserRepository : IRepository<ApplicationUser>
{
    Task<ApplicationUser?> GetByEmailAsync(string email, CancellationToken cancellationToken = default);

    Task<bool> EmailExistsAsync(string email, CancellationToken cancellationToken = default);

    /// <summary>Loads a user together with the names of every role assigned to them via UserRole/Role.</summary>
    Task<(ApplicationUser User, IReadOnlyList<string> Roles)?> GetByEmailWithRolesAsync(string email, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<string>> GetRoleNamesForUserAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>Creates the UserRole join row that assigns <paramref name="roleId"/> to <paramref name="userId"/>.</summary>
    Task AssignRoleAsync(Guid userId, Guid roleId, CancellationToken cancellationToken = default);
}
