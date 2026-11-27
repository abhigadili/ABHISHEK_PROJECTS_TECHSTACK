using HMS.Appointments.Data;
using HMS.Appointments.Domain;
using HMS.Appointments.Dtos;
using HMS.Shared.Cache;
using HMS.Shared.Common;
using HMS.Shared.Data;
using HMS.Shared.Http;
using HMS.Shared.Messaging;
using Microsoft.EntityFrameworkCore;

namespace HMS.Appointments.Services;

public interface IAppointmentAppService
{
    Task<List<SlotView>> AvailabilityAsync(long doctorId, DateOnly date, CancellationToken ct);
    Task<AppointmentResponse> BookAsync(BookRequest r, CancellationToken ct);
    Task<AppointmentResponse> RescheduleAsync(long id, RescheduleRequest r, CancellationToken ct);
    Task<AppointmentResponse> CancelAsync(long id, string? reason, CancellationToken ct);
    Task<AppointmentResponse> CompleteAsync(long id, string? notes, CancellationToken ct);
    Task<AppointmentResponse> GetAsync(long id, CancellationToken ct);
    Task<List<AppointmentResponse>> ForPatientAsync(long patientId, CancellationToken ct);
    Task<List<AppointmentResponse>> MineAsync(CancellationToken ct);
    Task<List<AppointmentResponse>> ForDoctorAsync(long doctorId, DateOnly? date, CancellationToken ct);
    Task ApplyBillingAsync(long appointmentId, string billNumber, PaymentStatus status, CancellationToken ct);
}

public sealed class AppointmentAppService(AppointmentDbContext db, IPatientDirectory patients, IDoctorDirectory doctors, IEventPublisher events, ICacheService cache,
    ICurrentUser user, IConfiguration cfg, ILogger<AppointmentAppService> log) : IAppointmentAppService
{
    private TimeSpan AvailabilityTtl => TimeSpan.FromSeconds(cfg.GetValue("Cache:AvailabilitySeconds", 60));
    private TimeSpan AppointmentTtl => TimeSpan.FromMinutes(cfg.GetValue("Cache:AppointmentMinutes", 5));
    private static string AvKey(long doctorId, DateOnly date) => $"availability:{doctorId}:{date:yyyy-MM-dd}";
    private static string ApKey(long id) => $"appointment:{id}";

    // ---- availability (Scenario 2 + 3) --------------------------------------------------------------------

    /// <summary>Doctor's slot grid (HttpClient -> Doctor Service) minus booked and elapsed slots. Cached briefly and evicted after every booking change;
    /// booking itself never relies on this cache - it re-reads the live grid and re-checks overlaps in the database.</summary>
    public async Task<List<SlotView>> AvailabilityAsync(long doctorId, DateOnly date, CancellationToken ct) =>
        await cache.GetOrCreateAsync(AvKey(doctorId, date), async t =>
        {
            var grid = await doctors.SlotsAsync(doctorId, date, t);
            var booked = await db.Appointments.AsNoTracking().Where(a => a.DoctorId == doctorId && a.AppointmentDate == date && a.Status == AppointmentStatus.BOOKED).ToListAsync(t);
            var now = DateTime.Now;
            return grid.Select(s => s with
            {
                Available = !booked.Any(a => a.StartTime < s.EndTime && a.EndTime > s.StartTime) && date.ToDateTime(s.StartTime) >= now
            }).ToList();
        }, AvailabilityTtl, ct) ?? [];

    // ---- booking ------------------------------------------------------------------------------------------

    public async Task<AppointmentResponse> BookAsync(BookRequest r, CancellationToken ct)
    {
        var patient = await patients.RequireAccessAsync(r.PatientId!.Value, ct);                 // gRPC
        if (patient.Status != "ACTIVE") throw new BadRequestException($"Patient {patient.Id} is not active");
        var doctor = await doctors.GetAsync(r.DoctorId!.Value, ct);                              // HttpClient
        if (!doctor.Active) throw new BadRequestException($"Doctor {doctor.Id} is not accepting appointments");
        var date = r.Date!.Value;
        var slot = await ResolveSlotAsync(doctor.Id, date, r.StartTime!.Value, ct);
        await AssertFreeAsync(doctor.Id, patient.Id, date, slot, null, ct);

        var a = new Appointment
        {
            PatientId = patient.Id, PatientName = patient.FullName, PatientEmail = patient.Email,
            DoctorId = doctor.Id, DoctorName = doctor.FullName, DoctorEmail = doctor.Email, Fee = doctor.ConsultationFee,
            AppointmentDate = date, StartTime = slot.StartTime, EndTime = slot.EndTime, Reason = r.Reason,
            SlotKey = Appointment.MakeSlotKey(doctor.Id, date, slot.StartTime)
        };
        try
        {
            await db.InTransactionAsync(async () =>
            {
                db.Appointments.Add(a);
                await db.SaveChangesAsync(ct);      // unique slot key: the loser of a concurrent race fails here
                events.Publish(Topics.AppointmentBooked, a.Id.ToString(), new AppointmentBooked(a.Id, a.PatientId, a.PatientName, a.PatientEmail, a.DoctorId, a.DoctorName,
                    a.DoctorEmail, a.AppointmentDate, a.StartTime, a.EndTime, a.Fee));
                await db.SaveChangesAsync(ct);
            }, ct);
        }
        catch (DbUpdateException) { throw new ConflictException("This slot has just been booked by someone else"); }
        await cache.RemoveAsync(AvKey(a.DoctorId, a.AppointmentDate), ct);                      // evict AFTER commit
        log.LogInformation("Booked appointment {AppointmentId} doctor={DoctorId} patient={PatientId} {Date} {Start}", a.Id, a.DoctorId, a.PatientId, a.AppointmentDate, a.StartTime);
        return AppointmentResponse.From(a);
    }

    public async Task<AppointmentResponse> RescheduleAsync(long id, RescheduleRequest r, CancellationToken ct)
    {
        var a = await FindAsync(id, ct);
        await AuthorizeParticipantAsync(a, ct);
        if (a.Status != AppointmentStatus.BOOKED) throw new ConflictException($"Only BOOKED appointments can be rescheduled (current: {a.Status})");
        var date = r.Date!.Value;
        var slot = await ResolveSlotAsync(a.DoctorId, date, r.StartTime!.Value, ct);
        await AssertFreeAsync(a.DoctorId, a.PatientId, date, slot, a.Id, ct);

        var oldDate = a.AppointmentDate;
        var oldStart = a.StartTime;
        a.AppointmentDate = date;
        a.StartTime = slot.StartTime;
        a.EndTime = slot.EndTime;
        a.SlotKey = Appointment.MakeSlotKey(a.DoctorId, date, slot.StartTime);
        a.ReminderSent = false;
        a.UpdatedAt = DateTime.UtcNow;
        try
        {
            await db.InTransactionAsync(async () =>
            {
                events.Publish(Topics.AppointmentRescheduled, a.Id.ToString(), new AppointmentRescheduled(a.Id, a.PatientId, a.PatientName, a.PatientEmail, a.DoctorId,
                    a.DoctorName, a.DoctorEmail, oldDate, oldStart, a.AppointmentDate, a.StartTime, a.EndTime));
                await db.SaveChangesAsync(ct);
            }, ct);
        }
        catch (DbUpdateException) { throw new ConflictException("The requested slot has just been booked by someone else"); }
        await cache.RemoveManyAsync([AvKey(a.DoctorId, oldDate), AvKey(a.DoctorId, a.AppointmentDate), ApKey(a.Id)], ct);
        log.LogInformation("Rescheduled appointment {AppointmentId} from {OldDate} {OldStart} to {NewDate} {NewStart}", id, oldDate, oldStart, a.AppointmentDate, a.StartTime);
        return AppointmentResponse.From(a);
    }

    public async Task<AppointmentResponse> CancelAsync(long id, string? reason, CancellationToken ct)
    {
        var a = await FindAsync(id, ct);
        await AuthorizeParticipantAsync(a, ct);
        if (a.Status != AppointmentStatus.BOOKED) throw new ConflictException($"Only BOOKED appointments can be cancelled (current: {a.Status})");
        if (a.StartsAt < DateTime.Now) throw new BadRequestException("The appointment time has already passed");
        a.Status = AppointmentStatus.CANCELLED;
        a.SlotKey = null;                               // frees the slot for new bookings
        a.CancelReason = reason;
        a.UpdatedAt = DateTime.UtcNow;
        var by = user.Username ?? "system";
        await db.InTransactionAsync(async () =>
        {
            events.Publish(Topics.AppointmentCancelled, a.Id.ToString(), new AppointmentCancelled(a.Id, a.PatientId, a.PatientName, a.PatientEmail, a.DoctorId, a.DoctorName,
                a.DoctorEmail, a.AppointmentDate, a.StartTime, by, reason));
            await db.SaveChangesAsync(ct);
        }, ct);
        await cache.RemoveManyAsync([AvKey(a.DoctorId, a.AppointmentDate), ApKey(a.Id)], ct);
        log.LogInformation("Cancelled appointment {AppointmentId} by {User}", id, by);
        return AppointmentResponse.From(a);
    }

    public async Task<AppointmentResponse> CompleteAsync(long id, string? notes, CancellationToken ct)
    {
        var a = await FindAsync(id, ct);
        if (!user.IsAdmin)
        {
            var d = await doctors.GetAsync(a.DoctorId, ct);
            if (d.UserId is null || d.UserId != user.Id) throw new ForbiddenException("Only the treating doctor can complete this appointment");
        }
        if (a.Status != AppointmentStatus.BOOKED) throw new ConflictException($"Only BOOKED appointments can be completed (current: {a.Status})");
        if (a.StartsAt > DateTime.Now) throw new BadRequestException("The appointment has not started yet");
        a.Status = AppointmentStatus.COMPLETED;
        a.Notes = notes;
        a.UpdatedAt = DateTime.UtcNow;
        await db.InTransactionAsync(async () =>
        {
            events.Publish(Topics.AppointmentCompleted, a.Id.ToString(), new AppointmentCompleted(a.Id, a.PatientId, a.DoctorId, a.DoctorName, a.AppointmentDate, notes));
            await db.SaveChangesAsync(ct);
        }, ct);
        await cache.RemoveAsync(ApKey(a.Id), ct);
        return AppointmentResponse.From(a);
    }

    // ---- reads --------------------------------------------------------------------------------------------

    public async Task<AppointmentResponse> GetAsync(long id, CancellationToken ct)
    {
        var a = await cache.GetOrCreateAsync(ApKey(id), async t => (await db.Appointments.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, t)) is { } e ? AppointmentResponse.From(e) : null, AppointmentTtl, ct)
                ?? throw new NotFoundException($"Appointment {id} not found");
        if (user.IsInRole(Roles.Patient) && !user.IsAdmin) await patients.RequireAccessAsync(a.PatientId, ct);
        return a;
    }

    public async Task<List<AppointmentResponse>> ForPatientAsync(long patientId, CancellationToken ct)
    {
        await patients.RequireAccessAsync(patientId, ct);
        return (await db.Appointments.AsNoTracking().Where(a => a.PatientId == patientId).OrderByDescending(a => a.AppointmentDate).ThenByDescending(a => a.StartTime).ToListAsync(ct)).Select(AppointmentResponse.From).ToList();
    }

    public async Task<List<AppointmentResponse>> MineAsync(CancellationToken ct)
    {
        var p = await patients.GetByUserAsync(user.Id ?? -1, ct);
        return await ForPatientAsync(p.Id, ct);
    }

    public async Task<List<AppointmentResponse>> ForDoctorAsync(long doctorId, DateOnly? date, CancellationToken ct)
    {
        var q = db.Appointments.AsNoTracking().Where(a => a.DoctorId == doctorId);
        if (date is not null) q = q.Where(a => a.AppointmentDate == date);
        return (await q.OrderBy(a => a.AppointmentDate).ThenBy(a => a.StartTime).ToListAsync(ct)).Select(AppointmentResponse.From).ToList();
    }

    // ---- event-driven update (Kafka consumer) -------------------------------------------------------------

    public async Task ApplyBillingAsync(long appointmentId, string billNumber, PaymentStatus status, CancellationToken ct)
    {
        var a = await db.Appointments.FirstOrDefaultAsync(x => x.Id == appointmentId, ct);
        if (a is null) { log.LogWarning("Billing event for unknown appointment {AppointmentId}", appointmentId); return; }
        a.BillNumber = billNumber;
        if (a.PaymentStatus != PaymentStatus.PAID) a.PaymentStatus = status;
        await db.SaveChangesAsync(ct);
        await cache.RemoveAsync(ApKey(a.Id), ct);
    }

    // ---- helpers ------------------------------------------------------------------------------------------

    private async Task<SlotView> ResolveSlotAsync(long doctorId, DateOnly date, TimeOnly start, CancellationToken ct)
    {
        if (date.ToDateTime(start) < DateTime.Now) throw new BadRequestException("Cannot book a time in the past");
        // always the live grid from the Doctor Service, never the cached availability view
        var grid = await doctors.SlotsAsync(doctorId, date, ct);
        return grid.FirstOrDefault(s => s.StartTime == start)
               ?? throw new BadRequestException($"The doctor does not offer a slot starting at {start:HH:mm} on {date:yyyy-MM-dd} (not a working day/hour, on a break, or on leave)");
    }

    private async Task AssertFreeAsync(long doctorId, long patientId, DateOnly date, SlotView slot, long? excludeId, CancellationToken ct)
    {
        if (await db.Appointments.AnyAsync(a => a.DoctorId == doctorId && a.AppointmentDate == date && a.Status == AppointmentStatus.BOOKED
                                                && a.StartTime < slot.EndTime && a.EndTime > slot.StartTime && (excludeId == null || a.Id != excludeId), ct))
            throw new ConflictException($"The doctor already has an appointment overlapping {slot.StartTime:HH:mm}-{slot.EndTime:HH:mm} on {date:yyyy-MM-dd}");
        if (await db.Appointments.AnyAsync(a => a.PatientId == patientId && a.AppointmentDate == date && a.Status == AppointmentStatus.BOOKED
                                                && a.StartTime < slot.EndTime && a.EndTime > slot.StartTime && (excludeId == null || a.Id != excludeId), ct))
            throw new ConflictException($"The patient already has an overlapping appointment on {date:yyyy-MM-dd}");
    }

    /// <summary>Admin, the treating doctor, or the patient who owns the appointment.</summary>
    private async Task AuthorizeParticipantAsync(Appointment a, CancellationToken ct)
    {
        if (user.IsAdmin) return;
        if (user.IsInRole(Roles.Patient)) { await patients.RequireAccessAsync(a.PatientId, ct); return; }
        if (user.IsInRole(Roles.Doctor))
        {
            var d = await doctors.GetAsync(a.DoctorId, ct);
            if (d.UserId is not null && d.UserId == user.Id) return;
        }
        throw new ForbiddenException("You are not a participant of this appointment");
    }

    private async Task<Appointment> FindAsync(long id, CancellationToken ct) =>
        await db.Appointments.FirstOrDefaultAsync(a => a.Id == id, ct) ?? throw new NotFoundException($"Appointment {id} not found");
}
