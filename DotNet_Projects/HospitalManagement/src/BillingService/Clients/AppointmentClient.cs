using HMS.Shared.Common;
using HMS.Shared.Http;
using Polly.CircuitBreaker;

namespace HMS.Billing.Clients;

public sealed record AppointmentView(long Id, long PatientId, string Status, decimal Fee);

public interface IAppointmentDirectory
{
    Task<AppointmentView> GetAsync(long appointmentId, CancellationToken ct);
}

/// <summary>Typed HttpClient (IHttpClientFactory + Polly pipeline) used to verify that a manually raised APPOINTMENT bill refers to the patient's real appointment.</summary>
public sealed class AppointmentClient(HttpClient http) : IAppointmentDirectory
{
    public async Task<AppointmentView> GetAsync(long appointmentId, CancellationToken ct)
    {
        try
        {
            return await DownstreamResponse.ReadAsync<AppointmentView>("appointment-service", () => http.GetAsync($"/api/appointments/{appointmentId}", ct), ct);
        }
        catch (BrokenCircuitException)
        {
            throw new ServiceUnavailableException($"Appointment service circuit is open - cannot verify appointment {appointmentId} right now");
        }
    }
}
