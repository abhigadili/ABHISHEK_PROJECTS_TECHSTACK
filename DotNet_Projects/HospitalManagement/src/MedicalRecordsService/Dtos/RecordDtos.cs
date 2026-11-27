using System.ComponentModel.DataAnnotations;
using HMS.Records.Domain;

namespace HMS.Records.Dtos;

public sealed class EntryRequest
{
    [Required] public long? PatientId { get; set; }
    [Required] public EntryType? EntryType { get; set; }
    [Required, StringLength(200)] public string Title { get; set; } = "";
    [StringLength(4000)] public string? Details { get; set; }
    public long? DoctorId { get; set; }
}

public sealed class EntryUpdateRequest
{
    [Required, StringLength(200)] public string Title { get; set; } = "";
    [StringLength(4000)] public string? Details { get; set; }
}

public sealed class ConditionsRequest { [StringLength(500)] public string? ChronicConditions { get; set; } }

public sealed record EntryResponse(long Id, long PatientId, EntryType EntryType, string Title, string? Details, long? DoctorId, string? ReferenceType, long? ReferenceId, string Source, DateTime RecordedAt)
{
    public static EntryResponse From(RecordEntry e) => new(e.Id, e.PatientId, e.EntryType, e.Title, e.Details, e.DoctorId, e.ReferenceType, e.ReferenceId, e.Source, e.RecordedAt);
}

public sealed record SummaryResponse(long PatientId, string PatientName, string? ChronicConditions, Dictionary<string, long> EntryCounts, List<EntryResponse> LatestEntries);
