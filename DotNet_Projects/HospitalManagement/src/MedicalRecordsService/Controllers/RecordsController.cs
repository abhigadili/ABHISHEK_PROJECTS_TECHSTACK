using HMS.Records.Domain;
using HMS.Records.Dtos;
using HMS.Records.Services;
using HMS.Shared.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HMS.Records.Controllers;

[ApiController, Authorize, Route("api/records")]
public sealed class RecordsController(IRecordService service) : ControllerBase
{
    [HttpPost("entries"), Authorize(Roles = "ADMIN,DOCTOR")]
    public async Task<IActionResult> Add([FromBody] EntryRequest r, CancellationToken ct) => StatusCode(201, await service.AddEntryAsync(r, ct));

    [HttpPut("entries/{id:long}"), Authorize(Roles = "ADMIN,DOCTOR")]
    public Task<EntryResponse> Update(long id, [FromBody] EntryUpdateRequest r, CancellationToken ct) => service.UpdateEntryAsync(id, r, ct);

    [HttpGet("entries/{id:long}"), Authorize(Roles = "ADMIN,DOCTOR,PATIENT")]
    public Task<EntryResponse> Entry(long id, CancellationToken ct) => service.EntryAsync(id, ct);

    [HttpGet("patients/{patientId:long}/entries"), Authorize(Roles = "ADMIN,DOCTOR,PATIENT")]
    public Task<PageResponse<EntryResponse>> Timeline(long patientId, [FromQuery] EntryType? type, [FromQuery] int page = 0, [FromQuery] int size = 20, CancellationToken ct = default)
        => service.TimelineAsync(patientId, type, page, size, ct);

    [HttpGet("patients/{patientId:long}/summary"), Authorize(Roles = "ADMIN,DOCTOR,PATIENT")]
    public Task<SummaryResponse> Summary(long patientId, CancellationToken ct) => service.SummaryAsync(patientId, ct);

    [HttpPut("patients/{patientId:long}/conditions"), Authorize(Roles = "ADMIN,DOCTOR")]
    public async Task<IActionResult> Conditions(long patientId, [FromBody] ConditionsRequest r, CancellationToken ct)
    {
        await service.UpdateConditionsAsync(patientId, r.ChronicConditions, ct);
        return NoContent();
    }
}
