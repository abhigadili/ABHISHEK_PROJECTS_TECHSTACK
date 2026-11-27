using HMS.Laboratory.Data;
using HMS.Laboratory.Domain;
using HMS.Laboratory.Dtos;
using HMS.Shared.Common;
using HMS.Shared.Data;
using HMS.Shared.Http;
using HMS.Shared.Messaging;
using Microsoft.EntityFrameworkCore;

namespace HMS.Laboratory.Services;

public interface ILabAppService
{
    Task<List<TestResponse>> CatalogueAsync(CancellationToken ct);
    Task<TestResponse> AddTestAsync(TestRequest r, CancellationToken ct);
    Task<LabRequestResponse> RequestAsync(LabRequestCreate c, CancellationToken ct);
    Task<LabRequestResponse> UpdateStatusAsync(long id, LabStatus target, CancellationToken ct);
    Task<LabRequestResponse> CancelAsync(long id, CancellationToken ct);
    Task<ReportResponse> SubmitReportAsync(long requestId, ReportRequest r, CancellationToken ct);
    Task<LabRequestResponse> GetAsync(long id, CancellationToken ct);
    Task<ReportResponse> ReportAsync(long requestId, CancellationToken ct);
    Task<List<LabRequestResponse>> ForPatientAsync(long patientId, CancellationToken ct);
    Task<PageResponse<LabRequestResponse>> QueueAsync(LabStatus? status, int page, int size, CancellationToken ct);
    Task EnqueueAsync(long requestId, CancellationToken ct);
}

public sealed class LabAppService(LaboratoryDbContext db, IPatientDirectory patients, IDoctorDirectory doctors, IEventPublisher events, ICurrentUser user,
    ILogger<LabAppService> log) : ILabAppService
{
    /// <summary>Allowed forward transitions of a request driven by laboratory staff.</summary>
    private static readonly Dictionary<LabStatus, LabStatus[]> Transitions = new()
    {
        [LabStatus.REQUESTED] = [LabStatus.SAMPLE_COLLECTED, LabStatus.CANCELLED],
        [LabStatus.SAMPLE_COLLECTED] = [LabStatus.IN_PROGRESS, LabStatus.CANCELLED],
        [LabStatus.IN_PROGRESS] = [LabStatus.CANCELLED]
    };

    public async Task<List<TestResponse>> CatalogueAsync(CancellationToken ct) =>
        (await db.Tests.AsNoTracking().Where(t => t.Active).OrderBy(t => t.Name).ToListAsync(ct)).Select(TestResponse.From).ToList();

    public async Task<TestResponse> AddTestAsync(TestRequest r, CancellationToken ct)
    {
        var code = r.Code.Trim().ToUpperInvariant();
        if (await db.Tests.AnyAsync(t => t.Code == code, ct)) throw new ConflictException($"Test code '{code}' already exists");
        var t = new LabTest { Code = code, Name = r.Name, SampleType = r.SampleType, Price = r.Price!.Value, TurnaroundHours = r.TurnaroundHours };
        db.Tests.Add(t);
        await db.SaveChangesAsync(ct);
        return TestResponse.From(t);
    }

    // ---- Scenario 4 ----------------------------------------------------------------------------------------

    public async Task<LabRequestResponse> RequestAsync(LabRequestCreate c, CancellationToken ct)
    {
        var patient = await patients.GetAsync(c.PatientId!.Value, ct);                // gRPC
        var doctor = await doctors.GetAsync(c.DoctorId!.Value, ct);                   // HttpClient
        if (!doctor.Active) throw new BadRequestException($"Doctor {doctor.Id} is not active");
        if (!user.IsAdmin && (doctor.UserId is null || doctor.UserId != user.Id)) throw new ForbiddenException("A doctor can only request tests in their own name");
        var code = c.TestCode.Trim().ToUpperInvariant();
        var test = await db.Tests.FirstOrDefaultAsync(t => t.Code == code && t.Active, ct) ?? throw new BadRequestException($"Unknown or inactive lab test '{c.TestCode}'");
        var r = new LabRequest
        {
            PatientId = patient.Id, PatientName = patient.FullName, PatientEmail = patient.Email, DoctorId = doctor.Id, AppointmentId = c.AppointmentId,
            Test = test, TestName = test.Name, Price = test.Price, Priority = c.Priority ?? LabPriority.ROUTINE, ClinicalNotes = c.ClinicalNotes
        };
        await db.InTransactionAsync(async () =>
        {
            db.Requests.Add(r);
            await db.SaveChangesAsync(ct);
            events.Publish(Topics.LabTestRequested, r.Id.ToString(), new LabTestRequested(r.Id, r.PatientId, r.PatientName, r.PatientEmail, r.DoctorId, test.Code, test.Name, r.Price, r.Priority.ToString()));
            await db.SaveChangesAsync(ct);
        }, ct);
        log.LogInformation("Lab request {RequestId} ({Test}) created for patient {PatientId}", r.Id, test.Code, r.PatientId);
        return LabRequestResponse.From(r);
    }

    public async Task<LabRequestResponse> UpdateStatusAsync(long id, LabStatus target, CancellationToken ct)
    {
        var r = await FindAsync(id, ct);
        if (target == LabStatus.COMPLETED) throw new BadRequestException("A request becomes COMPLETED only when its report is submitted");
        if (!Transitions.TryGetValue(r.Status, out var allowed) || !allowed.Contains(target)) throw new ConflictException($"Invalid status change {r.Status} -> {target}");
        r.Status = target;
        r.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return LabRequestResponse.From(r);
    }

    public async Task<LabRequestResponse> CancelAsync(long id, CancellationToken ct)
    {
        var r = await FindAsync(id, ct);
        if (r.Status is not (LabStatus.REQUESTED or LabStatus.SAMPLE_COLLECTED)) throw new ConflictException($"Only REQUESTED or SAMPLE_COLLECTED requests can be cancelled (current: {r.Status})");
        r.Status = LabStatus.CANCELLED;
        r.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return LabRequestResponse.From(r);
    }

    public async Task<ReportResponse> SubmitReportAsync(long requestId, ReportRequest rr, CancellationToken ct)
    {
        var r = await FindAsync(requestId, ct);
        if (r.Status != LabStatus.IN_PROGRESS) throw new ConflictException($"A report can only be submitted for IN_PROGRESS requests (current: {r.Status})");
        if (await db.Reports.AnyAsync(x => x.RequestId == requestId, ct)) throw new ConflictException("A report already exists for this request");
        var rep = new LabReport { Request = r, ResultSummary = rr.ResultSummary, ResultDetails = rr.ResultDetails, ReferenceRange = rr.ReferenceRange, Abnormal = rr.Abnormal, ReportedBy = user.Username ?? "system" };
        await db.InTransactionAsync(async () =>
        {
            db.Reports.Add(rep);
            r.Status = LabStatus.COMPLETED;
            r.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);
            events.Publish(Topics.LabReportGenerated, rep.Id.ToString(), new LabReportGenerated(rep.Id, r.Id, r.PatientId, r.PatientName, r.PatientEmail, r.DoctorId, r.TestName, rep.ResultSummary, rep.Abnormal));
            await db.SaveChangesAsync(ct);
        }, ct);
        log.LogInformation("Lab report {ReportId} generated for request {RequestId}", rep.Id, r.Id);
        return ReportResponse.From(rep);
    }

    // ---- reads ---------------------------------------------------------------------------------------------

    public async Task<LabRequestResponse> GetAsync(long id, CancellationToken ct)
    {
        var r = await FindAsync(id, ct);
        await GuardAsync(r.PatientId, ct);
        return LabRequestResponse.From(r);
    }

    public async Task<ReportResponse> ReportAsync(long requestId, CancellationToken ct)
    {
        var r = await FindAsync(requestId, ct);
        await GuardAsync(r.PatientId, ct);
        var rep = await db.Reports.AsNoTracking().Include(x => x.Request).FirstOrDefaultAsync(x => x.RequestId == requestId, ct)
                  ?? throw new NotFoundException($"No report available yet for request {requestId} (status {r.Status})");
        return ReportResponse.From(rep);
    }

    public async Task<List<LabRequestResponse>> ForPatientAsync(long patientId, CancellationToken ct)
    {
        await patients.RequireAccessAsync(patientId, ct);
        return (await db.Requests.AsNoTracking().Include(r => r.Test).Where(r => r.PatientId == patientId).OrderByDescending(r => r.RequestedAt).ToListAsync(ct)).Select(LabRequestResponse.From).ToList();
    }

    public async Task<PageResponse<LabRequestResponse>> QueueAsync(LabStatus? status, int page, int size, CancellationToken ct)
    {
        size = Math.Clamp(size, 1, 100);
        var q = db.Requests.AsNoTracking().Include(r => r.Test).AsQueryable();
        if (status is not null) q = q.Where(r => r.Status == status);
        var total = await q.LongCountAsync(ct);
        var rows = await q.OrderByDescending(r => r.Priority).ThenBy(r => r.RequestedAt).Skip(page * size).Take(size).ToListAsync(ct);
        return new PageResponse<LabRequestResponse>(rows.Select(LabRequestResponse.From).ToList(), page, size, total, (int)Math.Ceiling(total / (double)size));
    }

    // ---- Kafka-driven background step ---------------------------------------------------------------------

    /// <summary>Consumer of LabTestRequested: puts the request in the lab work queue by assigning an accession number.</summary>
    public async Task EnqueueAsync(long requestId, CancellationToken ct)
    {
        var r = await db.Requests.FirstOrDefaultAsync(x => x.Id == requestId, ct);
        if (r is null || r.AccessionNumber is not null) return;
        r.AccessionNumber = $"LAB-{DateTime.Now:yyyyMMdd}-{r.Id:D6}";
        r.QueuedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        log.LogInformation("Lab request {RequestId} queued with accession {Accession}", r.Id, r.AccessionNumber);
    }

    private async Task GuardAsync(long patientId, CancellationToken ct)
    {
        if (user.IsInRole(Roles.Patient)) await patients.RequireAccessAsync(patientId, ct);
    }

    private async Task<LabRequest> FindAsync(long id, CancellationToken ct) =>
        await db.Requests.Include(r => r.Test).FirstOrDefaultAsync(r => r.Id == id, ct) ?? throw new NotFoundException($"Lab request {id} not found");
}

/// <summary>The Laboratory Service is notified of new work through Kafka (decoupled from the request transaction).</summary>
public sealed class LabTestRequestedHandler(ILabAppService service) : KafkaEventHandler<LabTestRequested>
{
    public override string Topic => Topics.LabTestRequested;
    protected override Task HandleAsync(LabTestRequested e, CancellationToken ct) => service.EnqueueAsync(e.RequestId, ct);
}

/// <summary>Seeds a small standard catalogue the first time the service starts.</summary>
public static class LabCatalogSeeder
{
    public static async Task SeedAsync(IServiceProvider sp)
    {
        using var scope = sp.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<LaboratoryDbContext>();
        if (await db.Tests.AnyAsync()) return;
        db.Tests.AddRange(
            T("CBC", "Complete Blood Count", "Blood", 350m, 6), T("LIPID", "Lipid Profile", "Blood", 600m, 12), T("HBA1C", "HbA1c (Glycated Hemoglobin)", "Blood", 550m, 12),
            T("TSH", "Thyroid Stimulating Hormone", "Blood", 450m, 12), T("UA", "Urine Analysis", "Urine", 200m, 4), T("LFT", "Liver Function Test", "Blood", 700m, 12));
        await db.SaveChangesAsync();
        scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("Seeder").LogInformation("Seeded 6 lab tests");
    }

    private static LabTest T(string code, string name, string sample, decimal price, int hours) => new() { Code = code, Name = name, SampleType = sample, Price = price, TurnaroundHours = hours };
}
