using Grpc.Core;
using HMS.Contracts.Prescriptions;
using HMS.Prescriptions.Data;
using HMS.Shared.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;

namespace HMS.Prescriptions.Grpc;

/// <summary>gRPC server (HTTP/2 port): lets the Pharmacy Service verify a prescription before dispensing. JWT required.</summary>
[Authorize(Roles = "ADMIN,PHARMACIST,DOCTOR")]
public sealed class PrescriptionGrpcService(PrescriptionDbContext db) : PrescriptionGrpc.PrescriptionGrpcBase
{
    public override async Task<PrescriptionStatusReply> GetStatus(PrescriptionIdRequest request, ServerCallContext context)
    {
        var p = await db.Prescriptions.AsNoTracking().FirstOrDefaultAsync(x => x.Id == request.PrescriptionId, context.CancellationToken)
                ?? throw new RpcException(new Status(StatusCode.NotFound, $"Prescription {request.PrescriptionId} not found"));
        return new PrescriptionStatusReply { Id = p.Id, PatientId = p.PatientId, Status = p.Status.ToString() };
    }
}
