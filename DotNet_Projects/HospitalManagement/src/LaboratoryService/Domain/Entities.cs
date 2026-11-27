namespace HMS.Laboratory.Domain;

public enum LabStatus { REQUESTED, SAMPLE_COLLECTED, IN_PROGRESS, COMPLETED, CANCELLED }
public enum LabPriority { ROUTINE, URGENT, STAT }

/// <summary>Catalogue of tests the laboratory offers, with the price used for billing.</summary>
public class LabTest
{
    public long Id { get; set; }
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public string? SampleType { get; set; }
    public decimal Price { get; set; }
    public int? TurnaroundHours { get; set; }
    public bool Active { get; set; } = true;
}

public class LabRequest
{
    public long Id { get; set; }
    public long PatientId { get; set; }
    public string PatientName { get; set; } = "";
    public string? PatientEmail { get; set; }
    public long DoctorId { get; set; }
    public long? AppointmentId { get; set; }
    public long TestId { get; set; }
    public LabTest? Test { get; set; }
    public string TestName { get; set; } = "";
    public decimal Price { get; set; }
    public LabPriority Priority { get; set; } = LabPriority.ROUTINE;
    public LabStatus Status { get; set; } = LabStatus.REQUESTED;
    public string? ClinicalNotes { get; set; }
    public string? AccessionNumber { get; set; }
    public DateTime? QueuedAt { get; set; }
    public DateTime RequestedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public LabReport? Report { get; set; }
}

public class LabReport
{
    public long Id { get; set; }
    public long RequestId { get; set; }
    public LabRequest? Request { get; set; }
    public string ResultSummary { get; set; } = "";
    public string? ResultDetails { get; set; }
    public string? ReferenceRange { get; set; }
    public bool Abnormal { get; set; }
    public string ReportedBy { get; set; } = "";
    public DateTime ReportedAt { get; set; } = DateTime.UtcNow;
}
