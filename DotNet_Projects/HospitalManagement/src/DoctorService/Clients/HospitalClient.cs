using HMS.Shared.Common;
using HMS.Shared.Http;
using Polly.CircuitBreaker;

namespace HMS.Doctors.Clients;

public interface IHospitalDirectory
{
    /// <summary>Verifies that the hospital (and optional department) exist, are active and belong together.</summary>
    Task ValidateAsync(long hospitalId, long? departmentId, CancellationToken ct);
}

/// <summary>Typed HttpClient (IHttpClientFactory + Polly pipeline) to the Hospital Service. A reference must not be stored unverified, so failures end in 503, never in a guess.</summary>
public sealed class HospitalClient(HttpClient http) : IHospitalDirectory
{
    private sealed record HospitalView(long Id, string Name, bool Active);
    private sealed record DepartmentView(long Id, long HospitalId, string Name, bool Active);

    public async Task ValidateAsync(long hospitalId, long? departmentId, CancellationToken ct)
    {
        try
        {
            HospitalView h;
            try { h = await DownstreamResponse.ReadAsync<HospitalView>("hospital-service", () => http.GetAsync($"/api/hospitals/{hospitalId}", ct), ct); }
            catch (NotFoundException) { throw new BadRequestException($"Hospital {hospitalId} does not exist"); }
            if (!h.Active) throw new BadRequestException($"Hospital {hospitalId} is not active");
            if (departmentId is null) return;
            DepartmentView d;
            try { d = await DownstreamResponse.ReadAsync<DepartmentView>("hospital-service", () => http.GetAsync($"/api/departments/{departmentId}", ct), ct); }
            catch (NotFoundException) { throw new BadRequestException($"Department {departmentId} does not exist"); }
            if (!d.Active || d.HospitalId != hospitalId) throw new BadRequestException($"Department {departmentId} is not an active department of hospital {hospitalId}");
        }
        catch (BrokenCircuitException)
        {
            throw new ServiceUnavailableException("Hospital service circuit is open - cannot verify hospital/department right now");
        }
    }
}
