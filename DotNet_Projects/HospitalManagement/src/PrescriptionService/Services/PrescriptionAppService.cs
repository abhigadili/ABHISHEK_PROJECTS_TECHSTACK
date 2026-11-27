using HMS.Prescriptions.Data;
using HMS.Prescriptions.Domain;
using HMS.Prescriptions.Dtos;
using HMS.Shared.Common;
using HMS.Shared.Data;
using HMS.Shared.Hosting;
using HMS.Shared.Http;
using HMS.Shared.Messaging;
using Microsoft.EntityFrameworkCore;

namespace HMS.Prescriptions.Services;

public interface IPrescriptionAppService
{
    Task<PrescriptionResponse> CreateAsync(PrescriptionRequest r, CancellationToken ct);
    Task<PrescriptionResponse> GetAsync(long id, CancellationToken ct);
    Task<StatusResponse> StatusAsync(long id, CancellationToken ct);
    Task<List<PrescriptionResponse>> ForPatientAsync(long patientId, CancellationToken ct);
    Task<List<PrescriptionResponse>> ForDoctorAsync(long doctorId, CancellationToken ct);
    Task<StatusResponse> CancelAsync(long id, CancellationToken ct);
    Task MarkDispensedAsync(long prescriptionId, CancellationToken ct);
    Task<int> ExpireOverdueAsync(CancellationToken ct);
}

public sealed class PrescriptionAppService(PrescriptionDbContext db, IPatientDirectory patients, IDoctorDirectory doctors, IEventPublisher events, ICurrentUser user,
    IConfiguration cfg, ILogger<PrescriptionAppService> log) : IPrescriptionAppService
{
    public async Task<PrescriptionResponse> CreateAsync(PrescriptionRequest r, CancellationToken ct)
    {
        var patient = await patients.GetAsync(r.PatientId!.Value, ct);                      // gRPC
        if (patient.Status != "ACTIVE") throw new BadRequestException($"Patient {patient.Id} is not active");
        var doctor = await doctors.GetAsync(r.DoctorId!.Value, ct);                         // HttpClient
        if (!doctor.Active) throw new BadRequestException($"Doctor {doctor.Id} is not active");
        if (!user.IsAdmin && (doctor.UserId is null || doctor.UserId != user.Id)) throw new ForbiddenException("A doctor can only issue prescriptions in their own name");

        var p = new Prescription
        {
            PatientId = patient.Id, PatientName = patient.FullName, PatientEmail = patient.Email, DoctorId = doctor.Id, DoctorName = doctor.FullName,
            AppointmentId = r.AppointmentId, Diagnosis = r.Diagnosis, Notes = r.Notes,
            ValidUntil = DateOnly.FromDateTime(DateTime.Now).AddDays(r.ValidDays ?? cfg.GetValue("Prescription:DefaultValidityDays", 30))
        };
        foreach (var i in r.Items)
            p.Items.Add(new PrescriptionItem { MedicineName = i.MedicineName.Trim(), Dosage = i.Dosage, Frequency = i.Frequency, DurationDays = i.DurationDays!.Value, Quantity = i.Quantity!.Value, Instructions = i.Instructions });
        await db.InTransactionAsync(async () =>
        {
            db.Prescriptions.Add(p);
            await db.SaveChangesAsync(ct);
            events.Publish(Topics.PrescriptionCreated, p.Id.ToString(), new PrescriptionCreated(p.Id, p.PatientId, p.PatientName, p.PatientEmail, p.DoctorId, p.DoctorName, p.ValidUntil, p.Diagnosis,
                p.Items.Select(i => new PrescribedItem(i.MedicineName, i.Dosage, i.Frequency, i.DurationDays, i.Quantity)).ToList()));
            await db.SaveChangesAsync(ct);
        }, ct);
        log.LogInformation("Prescription {PrescriptionId} created for patient {PatientId} by doctor {DoctorId}", p.Id, p.PatientId, p.DoctorId);
        return PrescriptionResponse.From(p);
    }

    public async Task<PrescriptionResponse> GetAsync(long id, CancellationToken ct)
    {
        var p = await FindAsync(id, ct);
        if (user.IsInRole(Roles.Patient)) await patients.RequireAccessAsync(p.PatientId, ct);
        return PrescriptionResponse.From(p);
    }

    public async Task<StatusResponse> StatusAsync(long id, CancellationToken ct)
    {
        var p = await db.Prescriptions.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException($"Prescription {id} not found");
        if (user.IsInRole(Roles.Patient)) await patients.RequireAccessAsync(p.PatientId, ct);
        return new StatusResponse(p.Id, p.Status, p.StatusChangedAt);
    }

    public async Task<List<PrescriptionResponse>> ForPatientAsync(long patientId, CancellationToken ct)
    {
        await patients.RequireAccessAsync(patientId, ct);
        return (await db.Prescriptions.AsNoTracking().Include(p => p.Items).Where(p => p.PatientId == patientId).OrderByDescending(p => p.IssuedAt).ToListAsync(ct)).Select(PrescriptionResponse.From).ToList();
    }

    public async Task<List<PrescriptionResponse>> ForDoctorAsync(long doctorId, CancellationToken ct) =>
        (await db.Prescriptions.AsNoTracking().Include(p => p.Items).Where(p => p.DoctorId == doctorId).OrderByDescending(p => p.IssuedAt).ToListAsync(ct)).Select(PrescriptionResponse.From).ToList();

    public async Task<StatusResponse> CancelAsync(long id, CancellationToken ct)
    {
        var p = await FindAsync(id, ct);
        if (!user.IsAdmin)
        {
            var d = await doctors.GetAsync(p.DoctorId, ct);
            if (d.UserId is null || d.UserId != user.Id) throw new ForbiddenException("Only the prescribing doctor can cancel this prescription");
        }
        if (p.Status != PrescriptionStatus.ACTIVE) throw new ConflictException($"Only ACTIVE prescriptions can be cancelled (current: {p.Status})");
        SetStatus(p, PrescriptionStatus.CANCELLED);
        await db.SaveChangesAsync(ct);
        return new StatusResponse(p.Id, p.Status, p.StatusChangedAt);
    }

    /// <summary>Consumer of MedicineDispensed (from Pharmacy).</summary>
    public async Task MarkDispensedAsync(long prescriptionId, CancellationToken ct)
    {
        var p = await db.Prescriptions.FirstOrDefaultAsync(x => x.Id == prescriptionId, ct);
        if (p is null) { log.LogWarning("MedicineDispensed for unknown prescription {PrescriptionId}", prescriptionId); return; }
        if (p.Status == PrescriptionStatus.ACTIVE) { SetStatus(p, PrescriptionStatus.DISPENSED); await db.SaveChangesAsync(ct); }
    }

    public async Task<int> ExpireOverdueAsync(CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(DateTime.Now);
        var overdue = await db.Prescriptions.Where(p => p.Status == PrescriptionStatus.ACTIVE && p.ValidUntil < today).ToListAsync(ct);
        foreach (var p in overdue) SetStatus(p, PrescriptionStatus.EXPIRED);
        if (overdue.Count > 0) await db.SaveChangesAsync(ct);
        return overdue.Count;
    }

    private static void SetStatus(Prescription p, PrescriptionStatus s) { p.Status = s; p.StatusChangedAt = DateTime.UtcNow; }

    private async Task<Prescription> FindAsync(long id, CancellationToken ct) =>
        await db.Prescriptions.Include(p => p.Items).FirstOrDefaultAsync(p => p.Id == id, ct) ?? throw new NotFoundException($"Prescription {id} not found");
}

public sealed class MedicineDispensedHandler(IPrescriptionAppService service) : KafkaEventHandler<MedicineDispensed>
{
    public override string Topic => Topics.MedicineDispensed;
    protected override Task HandleAsync(MedicineDispensed e, CancellationToken ct) => service.MarkDispensedAsync(e.PrescriptionId, ct);
}

/// <summary>Hosted scheduler: expires prescriptions past their validity date.</summary>
public sealed class PrescriptionExpiryJob(IServiceScopeFactory scopes, IConfiguration cfg, ILogger<PrescriptionExpiryJob> log)
    : PeriodicJob(scopes, cfg, log, "prescription-expiry", "Scheduler:ExpiryIntervalSeconds", 600)
{
    protected override async Task RunAsync(IServiceProvider sp, CancellationToken ct)
    {
        var n = await sp.GetRequiredService<IPrescriptionAppService>().ExpireOverdueAsync(ct);
        if (n > 0) log.LogInformation("Prescription expiry job: {Count} prescription(s) expired", n);
    }
}
