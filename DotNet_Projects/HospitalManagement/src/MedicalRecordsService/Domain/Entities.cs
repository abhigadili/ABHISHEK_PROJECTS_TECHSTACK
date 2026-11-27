namespace HMS.Records.Domain;

public enum EntryType { DIAGNOSIS, VISIT, LAB_REPORT, PRESCRIPTION, ALLERGY, NOTE }

/// <summary>Per-patient clinical file header, created automatically from the PatientRegistered event.</summary>
public class PatientRecord
{
    public long Id { get; set; }
    public long PatientId { get; set; }
    public string PatientName { get; set; } = "";
    public string? ChronicConditions { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public List<RecordEntry> Entries { get; set; } = [];
}

/// <summary>One item on the patient's clinical timeline. ReferenceType/ReferenceId point at the source in another service (logical link).</summary>
public class RecordEntry
{
    public long Id { get; set; }
    public long RecordId { get; set; }
    public PatientRecord? Record { get; set; }
    public long PatientId { get; set; }
    public EntryType EntryType { get; set; }
    public string Title { get; set; } = "";
    public string? Details { get; set; }
    public long? DoctorId { get; set; }
    public string? ReferenceType { get; set; }
    public long? ReferenceId { get; set; }
    public string Source { get; set; } = "MANUAL";
    public DateTime RecordedAt { get; set; } = DateTime.UtcNow;
}
