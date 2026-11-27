using System.ComponentModel.DataAnnotations;
using HMS.Laboratory.Domain;

namespace HMS.Laboratory.Dtos;

public sealed class TestRequest
{
    [Required, StringLength(30)] public string Code { get; set; } = "";
    [Required, StringLength(150)] public string Name { get; set; } = "";
    [StringLength(60)] public string? SampleType { get; set; }
    [Required, Range(0, 1000000)] public decimal? Price { get; set; }
    public int? TurnaroundHours { get; set; }
}

public sealed record TestResponse(long Id, string Code, string Name, string? SampleType, decimal Price, int? TurnaroundHours)
{
    public static TestResponse From(LabTest t) => new(t.Id, t.Code, t.Name, t.SampleType, t.Price, t.TurnaroundHours);
}

public sealed class LabRequestCreate
{
    [Required] public long? PatientId { get; set; }
    [Required] public long? DoctorId { get; set; }
    public long? AppointmentId { get; set; }
    [Required] public string TestCode { get; set; } = "";
    public LabPriority? Priority { get; set; }
    [StringLength(500)] public string? ClinicalNotes { get; set; }
}

public sealed class StatusUpdate { [Required] public LabStatus? Status { get; set; } }

public sealed class ReportRequest
{
    [Required, StringLength(1000)] public string ResultSummary { get; set; } = "";
    [StringLength(4000)] public string? ResultDetails { get; set; }
    [StringLength(200)] public string? ReferenceRange { get; set; }
    public bool Abnormal { get; set; }
}

public sealed record LabRequestResponse(long Id, long PatientId, string PatientName, long DoctorId, long? AppointmentId, string TestCode, string TestName, decimal Price,
    LabPriority Priority, LabStatus Status, string? ClinicalNotes, string? AccessionNumber, DateTime RequestedAt)
{
    public static LabRequestResponse From(LabRequest r) => new(r.Id, r.PatientId, r.PatientName, r.DoctorId, r.AppointmentId, r.Test?.Code ?? "", r.TestName, r.Price, r.Priority,
        r.Status, r.ClinicalNotes, r.AccessionNumber, r.RequestedAt);
}

public sealed record ReportResponse(long Id, long RequestId, long PatientId, string TestName, string ResultSummary, string? ResultDetails, string? ReferenceRange, bool Abnormal, string ReportedBy, DateTime ReportedAt)
{
    public static ReportResponse From(LabReport r) => new(r.Id, r.RequestId, r.Request!.PatientId, r.Request.TestName, r.ResultSummary, r.ResultDetails, r.ReferenceRange, r.Abnormal, r.ReportedBy, r.ReportedAt);
}
