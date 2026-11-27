using HMS.Records.Data;
using HMS.Records.Domain;
using HMS.Records.Dtos;
using HMS.Shared.Common;
using HMS.Shared.Http;
using HMS.Shared.Messaging;
using Microsoft.EntityFrameworkCore;

namespace HMS.Records.Services;

public interface IRecordService
{
    Task<EntryResponse> AddEntryAsync(EntryRequest r, CancellationToken ct);
    Task<EntryResponse> UpdateEntryAsync(long id, EntryUpdateRequest r, CancellationToken ct);
    Task UpdateConditionsAsync(long patientId, string? conditions, CancellationToken ct);
    Task<PageResponse<EntryResponse>> TimelineAsync(long patientId, EntryType? type, int page, int size, CancellationToken ct);
    Task<EntryResponse> EntryAsync(long id, CancellationToken ct);
    Task<SummaryResponse> SummaryAsync(long patientId, CancellationToken ct);
    Task InitRecordAsync(long patientId, string name, CancellationToken ct);
    Task AddSystemEntryAsync(long patientId, string? patientName, EntryType type, string title, string? details, long? doctorId, string referenceType, long referenceId, CancellationToken ct);
}

public sealed class RecordService(RecordsDbContext db, IPatientDirectory patients, ILogger<RecordService> log) : IRecordService
{
    public async Task<EntryResponse> AddEntryAsync(EntryRequest r, CancellationToken ct)
    {
        var p = await patients.GetAsync(r.PatientId!.Value, ct);
        var rec = await EnsureRecordAsync(p.Id, p.FullName, ct);
        var e = new RecordEntry { Record = rec, PatientId = p.Id, EntryType = r.EntryType!.Value, Title = r.Title, Details = r.Details, DoctorId = r.DoctorId };
        db.Entries.Add(e);
        await db.SaveChangesAsync(ct);
        return EntryResponse.From(e);
    }

    public async Task<EntryResponse> UpdateEntryAsync(long id, EntryUpdateRequest r, CancellationToken ct)
    {
        var e = await db.Entries.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException($"Entry {id} not found");
        if (e.Source != "MANUAL") throw new ConflictException("System-generated entries cannot be edited");
        e.Title = r.Title;
        e.Details = r.Details;
        await db.SaveChangesAsync(ct);
        return EntryResponse.From(e);
    }

    public async Task UpdateConditionsAsync(long patientId, string? conditions, CancellationToken ct)
    {
        var p = await patients.GetAsync(patientId, ct);
        var rec = await EnsureRecordAsync(p.Id, p.FullName, ct);
        rec.ChronicConditions = conditions;
        rec.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
    }

    public async Task<PageResponse<EntryResponse>> TimelineAsync(long patientId, EntryType? type, int page, int size, CancellationToken ct)
    {
        await patients.RequireAccessAsync(patientId, ct);      // staff, or the patient themself
        size = Math.Clamp(size, 1, 100);
        var q = db.Entries.AsNoTracking().Where(e => e.PatientId == patientId);
        if (type is not null) q = q.Where(e => e.EntryType == type);
        var total = await q.LongCountAsync(ct);
        var rows = await q.OrderByDescending(e => e.RecordedAt).ThenByDescending(e => e.Id).Skip(page * size).Take(size).ToListAsync(ct);
        return new PageResponse<EntryResponse>(rows.Select(EntryResponse.From).ToList(), page, size, total, (int)Math.Ceiling(total / (double)size));
    }

    public async Task<EntryResponse> EntryAsync(long id, CancellationToken ct)
    {
        var e = await db.Entries.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException($"Entry {id} not found");
        await patients.RequireAccessAsync(e.PatientId, ct);
        return EntryResponse.From(e);
    }

    public async Task<SummaryResponse> SummaryAsync(long patientId, CancellationToken ct)
    {
        await patients.RequireAccessAsync(patientId, ct);
        var rec = await db.PatientRecords.AsNoTracking().FirstOrDefaultAsync(r => r.PatientId == patientId, ct) ?? throw new NotFoundException($"No medical record exists yet for patient {patientId}");
        var counts = Enum.GetValues<EntryType>().ToDictionary(t => t.ToString(), _ => 0L);
        foreach (var g in await db.Entries.Where(e => e.PatientId == patientId).GroupBy(e => e.EntryType).Select(g => new { g.Key, N = g.LongCount() }).ToListAsync(ct)) counts[g.Key.ToString()] = g.N;
        var latest = await db.Entries.AsNoTracking().Where(e => e.PatientId == patientId).OrderByDescending(e => e.RecordedAt).Take(5).ToListAsync(ct);
        return new SummaryResponse(rec.PatientId, rec.PatientName, rec.ChronicConditions, counts, latest.Select(EntryResponse.From).ToList());
    }

    // ---- event-driven writes (Kafka consumers; the consumer runs them inside its inbox transaction) ----------

    public async Task InitRecordAsync(long patientId, string name, CancellationToken ct) => await EnsureRecordAsync(patientId, name, ct);

    /// <summary>Adds a system entry once per (type, source reference) so redelivered events never duplicate the timeline.</summary>
    public async Task AddSystemEntryAsync(long patientId, string? patientName, EntryType type, string title, string? details, long? doctorId, string referenceType, long referenceId, CancellationToken ct)
    {
        if (await db.Entries.AnyAsync(e => e.EntryType == type && e.ReferenceType == referenceType && e.ReferenceId == referenceId, ct)) return;
        var rec = await EnsureRecordAsync(patientId, patientName ?? $"Patient {patientId}", ct);
        db.Entries.Add(new RecordEntry
        {
            Record = rec, PatientId = patientId, EntryType = type, Title = title, Details = details, DoctorId = doctorId,
            ReferenceType = referenceType, ReferenceId = referenceId, Source = "EVENT"
        });
        await db.SaveChangesAsync(ct);
        log.LogInformation("Timeline entry {Type} added for patient {PatientId} ({Ref} #{RefId})", type, patientId, referenceType, referenceId);
    }

    private async Task<PatientRecord> EnsureRecordAsync(long patientId, string name, CancellationToken ct)
    {
        var rec = await db.PatientRecords.FirstOrDefaultAsync(r => r.PatientId == patientId, ct);
        if (rec is not null) return rec;
        rec = new PatientRecord { PatientId = patientId, PatientName = name };
        db.PatientRecords.Add(rec);
        await db.SaveChangesAsync(ct);
        return rec;
    }
}

/// <summary>Builds the clinical timeline from events published by the other services.</summary>
public sealed class PatientRegisteredHandler(IRecordService svc) : KafkaEventHandler<PatientRegistered>
{
    public override string Topic => Topics.PatientRegistered;
    protected override Task HandleAsync(PatientRegistered e, CancellationToken ct) => svc.InitRecordAsync(e.PatientId, $"{e.FirstName} {e.LastName}", ct);
}

public sealed class LabReportHandler(IRecordService svc) : KafkaEventHandler<LabReportGenerated>
{
    public override string Topic => Topics.LabReportGenerated;
    protected override Task HandleAsync(LabReportGenerated e, CancellationToken ct) =>
        svc.AddSystemEntryAsync(e.PatientId, e.PatientName, EntryType.LAB_REPORT, $"Lab report: {e.TestName}{(e.Abnormal ? " (ABNORMAL)" : "")}", e.Summary, e.DoctorId, "LAB_REPORT", e.ReportId, ct);
}

public sealed class PrescriptionHandler(IRecordService svc) : KafkaEventHandler<PrescriptionCreated>
{
    public override string Topic => Topics.PrescriptionCreated;
    protected override Task HandleAsync(PrescriptionCreated e, CancellationToken ct)
    {
        var sb = new System.Text.StringBuilder();
        if (e.Diagnosis is not null) sb.AppendLine($"Diagnosis: {e.Diagnosis}");
        foreach (var i in e.Items) sb.AppendLine($"- {i.MedicineName} {i.Dosage}, {i.Frequency}, {i.DurationDays} days");
        return svc.AddSystemEntryAsync(e.PatientId, e.PatientName, EntryType.PRESCRIPTION, $"Prescription #{e.PrescriptionId} by {e.DoctorName}", sb.ToString(), e.DoctorId, "PRESCRIPTION", e.PrescriptionId, ct);
    }
}

public sealed class AppointmentCompletedHandler(IRecordService svc) : KafkaEventHandler<AppointmentCompleted>
{
    public override string Topic => Topics.AppointmentCompleted;
    protected override Task HandleAsync(AppointmentCompleted e, CancellationToken ct) =>
        svc.AddSystemEntryAsync(e.PatientId, null, EntryType.VISIT, $"Visit with {e.DoctorName} on {e.Date:yyyy-MM-dd}", e.Notes, e.DoctorId, "APPOINTMENT", e.AppointmentId, ct);
}
