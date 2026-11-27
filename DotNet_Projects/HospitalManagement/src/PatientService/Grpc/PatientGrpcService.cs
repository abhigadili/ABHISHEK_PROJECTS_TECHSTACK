using Grpc.Core;
using HMS.Contracts.Patients;
using HMS.Patients.Services;
using HMS.Shared.Common;
using Microsoft.AspNetCore.Authorization;

namespace HMS.Patients.Grpc;

/// <summary>gRPC server (HTTP/2 port) - the strongly typed contract other services use to look patients up. JWT required.</summary>
[Authorize]
public sealed class PatientGrpcService(IPatientAppService patients, ILogger<PatientGrpcService> log) : PatientGrpc.PatientGrpcBase
{
    public override async Task<PatientSummaryReply> GetSummary(PatientIdRequest request, ServerCallContext context)
    {
        try { return Map(await patients.SummaryAsync(request.PatientId, context.CancellationToken)); }
        catch (NotFoundException e) { throw new RpcException(new Status(StatusCode.NotFound, e.Message)); }
    }

    public override async Task<PatientSummaryReply> GetByUser(UserIdRequest request, ServerCallContext context)
    {
        try { return Map(await patients.SummaryByUserAsync(request.UserId, context.CancellationToken)); }
        catch (NotFoundException e) { log.LogDebug("gRPC GetByUser: {Message}", e.Message); throw new RpcException(new Status(StatusCode.NotFound, e.Message)); }
    }

    private static PatientSummaryReply Map(Dtos.PatientSummaryResponse s) => new()
    {
        Id = s.Id, UserId = s.UserId ?? 0, FullName = s.FullName, Email = s.Email, Phone = s.Phone, Status = s.Status
    };
}
