namespace StudentMgmt.EnrollmentService.Entities;

/// <summary>
/// Lifecycle of a single enrollment record. Stored in MySQL as a string (via
/// <c>.HasConversion&lt;string&gt;()</c> in <see cref="Persistence.Configurations.EnrollmentConfiguration"/>)
/// so the column is human-readable when inspected directly in the database.
/// </summary>
public enum EnrollmentStatus
{
    Requested = 0,
    Confirmed = 1,
    Cancelled = 2
}
