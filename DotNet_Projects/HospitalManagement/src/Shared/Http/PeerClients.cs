using System.Collections.Concurrent;
using Grpc.Core;
using HMS.Contracts.Patients;
using HMS.Shared.Common;
using HMS.Shared.Grpc;
using Microsoft.Extensions.Logging;
using Polly;
using Polly.CircuitBreaker;
using Polly.Registry;

namespace HMS.Shared.Http;

public sealed record PatientSummary(long Id, long? UserId, string FullName, string? Email, string? Phone, string Status);

/// <summary>Patient lookups used by Appointment, Records, Prescription, Laboratory and Billing - over <b>gRPC</b>.</summary>
public interface IPatientDirectory
{
    Task<PatientSummary> GetAsync(long patientId, CancellationToken ct = default);
    Task<PatientSummary> GetByUserAsync(long userId, CancellationToken ct = default);
    /// <summary>Staff may read any patient; a PATIENT only their own (summary.UserId must equal the JWT subject).</summary>
    Task<PatientSummary> RequireAccessAsync(long patientId, CancellationToken ct = default);
}

public sealed class PatientDirectory(PatientGrpc.PatientGrpcClient client, ResiliencePipelineProvider<string> pipelines, ICurrentUser user,
    ILogger<PatientDirectory> log) : IPatientDirectory
{
    // last successfully fetched summaries: the fallback when the Patient Service is down / its circuit is open
    private static readonly ConcurrentDictionary<long, PatientSummary> LastKnown = new();

    public async Task<PatientSummary> GetAsync(long patientId, CancellationToken ct = default)
    {
        try
        {
            var reply = await pipelines.GetPipeline(GrpcResilience.Pipeline).ExecuteAsync(async t =>
                await client.GetSummaryAsync(new PatientIdRequest { PatientId = patientId }, deadline: GrpcResilience.Deadline(), cancellationToken: t), ct);
            var s = Map(reply);
            LastKnown[s.Id] = s;
            return s;
        }
        catch (RpcException e) when (e.StatusCode == StatusCode.NotFound) { throw new NotFoundException($"Patient {patientId} not found"); }
        catch (Exception e) when (e is RpcException or BrokenCircuitException or Polly.Timeout.TimeoutRejectedException)
        {
            if (LastKnown.TryGetValue(patientId, out var cached))
            {
                log.LogWarning("Patient service unavailable ({Error}); serving last-known summary of patient {PatientId}", e.GetType().Name, patientId);
                return cached;
            }
            throw new ServiceUnavailableException($"Patient service unavailable and no previously validated data for patient {patientId}");
        }
    }

    public async Task<PatientSummary> GetByUserAsync(long userId, CancellationToken ct = default)
    {
        try
        {
            var reply = await pipelines.GetPipeline(GrpcResilience.Pipeline).ExecuteAsync(async t =>
                await client.GetByUserAsync(new UserIdRequest { UserId = userId }, deadline: GrpcResilience.Deadline(), cancellationToken: t), ct);
            var s = Map(reply);
            LastKnown[s.Id] = s;
            return s;
        }
        catch (RpcException e) when (e.StatusCode == StatusCode.NotFound) { throw new NotFoundException($"No patient profile for user {userId}"); }
        catch (Exception e) when (e is RpcException or BrokenCircuitException or Polly.Timeout.TimeoutRejectedException)
        {
            throw new ServiceUnavailableException("Patient service unavailable, cannot resolve the patient profile right now");
        }
    }

    public async Task<PatientSummary> RequireAccessAsync(long patientId, CancellationToken ct = default)
    {
        var s = await GetAsync(patientId, ct);
        if (user.IsInRole(Roles.Patient) && !user.IsAdmin && (user.Id is null || user.Id != s.UserId))
            throw new ForbiddenException("Patients may only access their own data");
        return s;
    }

    private static PatientSummary Map(PatientSummaryReply r) => new(r.Id, r.UserId == 0 ? null : r.UserId, r.FullName, r.Email, r.Phone, r.Status);
}

public sealed record DoctorView(long Id, long? UserId, string FullName, string? Email, string? Phone, string Specialization, decimal ConsultationFee, bool Active);
public sealed record SlotView(TimeOnly StartTime, TimeOnly EndTime, bool Available = true);

/// <summary>Doctor lookups (profile, live slot grid) - over a typed <b>HttpClient</b> with the Polly pipeline.</summary>
public interface IDoctorDirectory
{
    Task<DoctorView> GetAsync(long doctorId, CancellationToken ct = default);
    Task<List<SlotView>> SlotsAsync(long doctorId, DateOnly date, CancellationToken ct = default);
}

public sealed class DoctorClient(HttpClient http, ILogger<DoctorClient> log) : IDoctorDirectory
{
    private static readonly ConcurrentDictionary<long, DoctorView> LastKnown = new();

    public async Task<DoctorView> GetAsync(long doctorId, CancellationToken ct = default)
    {
        try
        {
            var d = await DownstreamResponse.ReadAsync<DoctorView>("doctor-service", () => http.GetAsync($"/api/doctors/{doctorId}", ct), ct);
            LastKnown[doctorId] = d;
            return d;
        }
        catch (Exception e) when (e is BrokenCircuitException or ServiceUnavailableException)
        {
            if (LastKnown.TryGetValue(doctorId, out var cached))
            {
                log.LogWarning("Doctor service unavailable ({Error}); serving last-known doctor {DoctorId}", e.GetType().Name, doctorId);
                return cached;
            }
            throw new ServiceUnavailableException($"Doctor service unavailable and no previously validated data for doctor {doctorId}");
        }
    }

    public async Task<List<SlotView>> SlotsAsync(long doctorId, DateOnly date, CancellationToken ct = default)
    {
        try
        {
            return await DownstreamResponse.ReadAsync<List<SlotView>>("doctor-service", () => http.GetAsync($"/api/doctors/{doctorId}/slots?date={date:yyyy-MM-dd}", ct), ct);
        }
        catch (Exception e) when (e is BrokenCircuitException or ServiceUnavailableException)
        {
            // a booking must never be accepted against an unverified schedule: no fallback data, clean 503
            throw new ServiceUnavailableException(e is BrokenCircuitException ? "Doctor service circuit is open, schedule unavailable" : "Doctor schedule is temporarily unavailable, please try again shortly");
        }
    }
}
