namespace StudentMgmt.BuildingBlocks.Common.Entities;

/// <summary>
/// Every entity in every service (Student, Course, Enrollment, Notification, User,
/// RefreshToken, ...) inherits from this so auditing, soft delete and optimistic
/// concurrency are handled identically everywhere instead of being re-implemented
/// per entity.
/// </summary>
public abstract class BaseEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
    public string CreatedBy { get; set; } = "system";

    public DateTime? UpdatedDate { get; set; }
    public string? UpdatedBy { get; set; }

    public bool IsDeleted { get; set; }
    public DateTime? DeletedDate { get; set; }
    public string? DeletedBy { get; set; }

    /// <summary>
    /// EF Core configures this as a MySQL rowversion-equivalent concurrency token
    /// (see each service's *Configuration.cs) to prevent lost updates when two
    /// requests modify the same row concurrently.
    /// </summary>
    public byte[]? RowVersion { get; set; }
}
