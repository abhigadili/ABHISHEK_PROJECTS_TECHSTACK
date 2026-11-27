using Grpc.Core;
using HMS.Contracts.Prescriptions;
using HMS.Shared.Common;
using HMS.Shared.Grpc;
using Polly.CircuitBreaker;
using Polly.Registry;

namespace HMS.Pharmacy.Clients;

public sealed record PrescriptionStatusView(long Id, long PatientId, string Status);

public interface IPrescriptionDirectory
{
    Task<PrescriptionStatusView> StatusAsync(long prescriptionId, CancellationToken ct);
}

/// <summary>gRPC client (strongly typed contract from proto/prescription.proto) wrapped by the Polly "grpc" pipeline. Dispensing must never proceed on an unverified prescription, so failures end in 503.</summary>
public sealed class PrescriptionDirectory(PrescriptionGrpc.PrescriptionGrpcClient client, ResiliencePipelineProvider<string> pipelines) : IPrescriptionDirectory
{
    public async Task<PrescriptionStatusView> StatusAsync(long prescriptionId, CancellationToken ct)
    {
        try
        {
            var r = await pipelines.GetPipeline(GrpcResilience.Pipeline).ExecuteAsync(async t =>
                await client.GetStatusAsync(new PrescriptionIdRequest { PrescriptionId = prescriptionId }, deadline: GrpcResilience.Deadline(), cancellationToken: t), ct);
            return new PrescriptionStatusView(r.Id, r.PatientId, r.Status);
        }
        catch (RpcException e) when (e.StatusCode == StatusCode.NotFound) { throw new NotFoundException($"Prescription {prescriptionId} not found"); }
        catch (Exception e) when (e is RpcException or BrokenCircuitException or Polly.Timeout.TimeoutRejectedException)
        {
            throw new ServiceUnavailableException($"Prescription service unavailable - cannot verify prescription {prescriptionId} right now");
        }
    }
}
