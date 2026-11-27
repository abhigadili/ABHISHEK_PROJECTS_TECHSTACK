using StudentMgmt.BuildingBlocks.Common.Entities;

namespace StudentMgmt.StudentService.Entities;

/// <summary>
/// A refresh token issued alongside an access token. A token is "active" when
/// <see cref="RevokedAtUtc"/> is null and <see cref="ExpiresAtUtc"/> is in the future.
/// </summary>
public class RefreshToken : BaseEntity
{
    public Guid UserId { get; set; }
    public string Token { get; set; } = default!;
    public DateTime ExpiresAtUtc { get; set; }
    public string? CreatedByIp { get; set; }
    public DateTime? RevokedAtUtc { get; set; }
    public string? ReplacedByToken { get; set; }

    public bool IsActive => RevokedAtUtc is null && ExpiresAtUtc > DateTime.UtcNow;
}
