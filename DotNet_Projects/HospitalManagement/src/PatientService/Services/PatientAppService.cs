using HMS.Patients.Domain;
using HMS.Patients.Dtos;
using HMS.Shared.Cache;
using HMS.Shared.Common;
using HMS.Shared.Data;
using HMS.Shared.Messaging;
using Microsoft.EntityFrameworkCore;

namespace HMS.Patients.Services;

public interface IPatientAppService
{
    Task<PatientResponse> RegisterAsync(PatientRequest r, CancellationToken ct);
    Task<PatientResponse> GetAuthorizedAsync(long id, CancellationToken ct);
    Task<PatientResponse> ByUserAuthorizedAsync(long userId, CancellationToken ct);
    Task<PatientSummaryResponse> SummaryAsync(long id, CancellationToken ct);
    Task<PatientSummaryResponse> SummaryByUserAsync(long userId, CancellationToken ct);
    Task<PageResponse<PatientResponse>> SearchAsync(string? q, int page, int size, CancellationToken ct);
    Task<PatientResponse> UpdateAsync(long id, PatientRequest r, CancellationToken ct);
    Task DeactivateAsync(long id, CancellationToken ct);
}

public sealed class PatientAppService(DbContext db, IRepository<Patient> patients, IEventPublisher events, ICacheService cache, ICurrentUser user, IConfiguration cfg,
    ILogger<PatientAppService> log) : IPatientAppService
{
    private TimeSpan Ttl => TimeSpan.FromMinutes(cfg.GetValue("Cache:PatientMinutes", 10));
    private static string Key(long id) => $"patient:{id}";
    private static string SummaryKey(long id) => $"patient-summary:{id}";

    /// <summary>Scenario 1: validate -> reject duplicates -> store -> PatientRegistered event staged in the outbox in the SAME transaction.</summary>
    public async Task<PatientResponse> RegisterAsync(PatientRequest r, CancellationToken ct)
    {
        var userId = user.IsInRole(Roles.Patient) && !user.IsAdmin ? user.Id : r.UserId;
        var email = r.Email.Trim().ToLowerInvariant();
        var ident = string.IsNullOrWhiteSpace(r.IdentityNumber) ? null : r.IdentityNumber.Trim();
        if (userId is not null && await patients.AnyAsync(p => p.UserId == userId, ct)) throw new ConflictException("A patient profile already exists for this login");
        if (await patients.AnyAsync(p => p.Email == email, ct)) throw new ConflictException($"A patient with email '{email}' is already registered");
        if (await patients.AnyAsync(p => p.Phone == r.Phone, ct)) throw new ConflictException($"A patient with phone '{r.Phone}' is already registered");
        if (ident is not null && await patients.AnyAsync(p => p.IdentityNumber == ident, ct)) throw new ConflictException($"A patient with identity number '{ident}' is already registered");

        var p = new Patient { UserId = userId };
        Apply(p, r);
        try
        {
            await db.InTransactionAsync(async () =>
            {
                await patients.AddAsync(p, ct);
                await patients.SaveAsync(ct);   // INSERT patient -> generated id
                events.Publish(Topics.PatientRegistered, p.Id.ToString(), new PatientRegistered(p.Id, p.UserId, p.FirstName, p.LastName, p.Email, p.Phone));
                await patients.SaveAsync(ct);   // outbox row; commits together with the patient, the relay publishes it to Kafka afterwards
            }, ct);
        }
        catch (DbUpdateException) { throw new ConflictException("Duplicate patient (e-mail, phone, identity number or login already registered)"); }
        log.LogInformation("Registered patient {PatientId}", p.Id);
        return PatientResponse.From(p);
    }

    public async Task<PatientResponse> GetAuthorizedAsync(long id, CancellationToken ct)
    {
        var dto = await cache.GetOrCreateAsync(Key(id), async t => (await patients.Query().AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, t)) is { } p ? PatientResponse.From(p) : null, Ttl, ct)
                  ?? throw new NotFoundException($"Patient {id} not found");
        AssertOwnerOrStaff(dto.UserId);
        return dto;
    }

    public async Task<PatientResponse> ByUserAuthorizedAsync(long userId, CancellationToken ct)
    {
        var p = await patients.Query().AsNoTracking().FirstOrDefaultAsync(x => x.UserId == userId, ct) ?? throw new NotFoundException($"No patient profile for user {userId}");
        AssertOwnerOrStaff(p.UserId);
        return PatientResponse.From(p);
    }

    public async Task<PatientSummaryResponse> SummaryAsync(long id, CancellationToken ct) =>
        await cache.GetOrCreateAsync(SummaryKey(id), async t => (await patients.Query().AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, t)) is { } p ? ToSummary(p) : null, Ttl, ct)
        ?? throw new NotFoundException($"Patient {id} not found");

    public async Task<PatientSummaryResponse> SummaryByUserAsync(long userId, CancellationToken ct) =>
        ToSummary(await patients.Query().AsNoTracking().FirstOrDefaultAsync(x => x.UserId == userId, ct) ?? throw new NotFoundException($"No patient profile for user {userId}"));

    public async Task<PageResponse<PatientResponse>> SearchAsync(string? q, int page, int size, CancellationToken ct)
    {
        size = Math.Clamp(size, 1, 100);
        var query = patients.Query().AsNoTracking();
        if (!string.IsNullOrWhiteSpace(q))
        {
            var t = q.Trim().ToLower();
            query = query.Where(p => p.FirstName.ToLower().Contains(t) || p.LastName.ToLower().Contains(t) || p.Email.ToLower().Contains(t) || p.Phone.Contains(t));
        }
        var total = await query.LongCountAsync(ct);
        var rows = await query.OrderBy(p => p.LastName).ThenBy(p => p.FirstName).Skip(page * size).Take(size).ToListAsync(ct);
        return new PageResponse<PatientResponse>(rows.Select(PatientResponse.From).ToList(), page, size, total, (int)Math.Ceiling(total / (double)size));
    }

    public async Task<PatientResponse> UpdateAsync(long id, PatientRequest r, CancellationToken ct)
    {
        var p = await patients.GetAsync(id, ct) ?? throw new NotFoundException($"Patient {id} not found");
        AssertOwnerOrStaff(p.UserId);
        var email = r.Email.Trim().ToLowerInvariant();
        var ident = string.IsNullOrWhiteSpace(r.IdentityNumber) ? null : r.IdentityNumber.Trim();
        if (p.Email != email && await patients.AnyAsync(x => x.Email == email, ct)) throw new ConflictException($"Email '{email}' belongs to another patient");
        if (p.Phone != r.Phone && await patients.AnyAsync(x => x.Phone == r.Phone, ct)) throw new ConflictException($"Phone '{r.Phone}' belongs to another patient");
        if (ident is not null && p.IdentityNumber != ident && await patients.AnyAsync(x => x.IdentityNumber == ident, ct)) throw new ConflictException("Identity number belongs to another patient");
        Apply(p, r);
        p.UpdatedAt = DateTime.UtcNow;
        await patients.SaveAsync(ct);
        await cache.RemoveManyAsync([Key(id), SummaryKey(id)], ct);     // invalidate after the commit
        return PatientResponse.From(p);
    }

    public async Task DeactivateAsync(long id, CancellationToken ct)
    {
        var p = await patients.GetAsync(id, ct) ?? throw new NotFoundException($"Patient {id} not found");
        p.Status = PatientStatus.INACTIVE;
        p.UpdatedAt = DateTime.UtcNow;
        await patients.SaveAsync(ct);
        await cache.RemoveManyAsync([Key(id), SummaryKey(id)], ct);
    }

    private void AssertOwnerOrStaff(long? ownerUserId)
    {
        if (user.IsInRole(Roles.Patient) && !user.IsAdmin && (user.Id is null || user.Id != ownerUserId))
            throw new ForbiddenException("Patients may only access their own profile");
    }

    private static PatientSummaryResponse ToSummary(Patient p) => new(p.Id, p.UserId, p.FullName, p.Email, p.Phone, p.Status.ToString());

    private static void Apply(Patient p, PatientRequest r)
    {
        p.FirstName = r.FirstName.Trim();
        p.LastName = r.LastName.Trim();
        p.DateOfBirth = r.DateOfBirth!.Value;
        p.Gender = r.Gender!.Value;
        p.Email = r.Email.Trim().ToLowerInvariant();
        p.Phone = r.Phone;
        p.IdentityNumber = string.IsNullOrWhiteSpace(r.IdentityNumber) ? null : r.IdentityNumber.Trim();
        p.BloodGroup = r.BloodGroup;
        p.Address = r.Address;
        p.EmergencyContactName = r.EmergencyContactName;
        p.EmergencyContactPhone = r.EmergencyContactPhone;
        p.KnownAllergies = r.KnownAllergies;
    }
}
