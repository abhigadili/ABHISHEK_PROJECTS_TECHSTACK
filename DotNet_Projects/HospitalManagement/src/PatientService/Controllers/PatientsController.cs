using HMS.Patients.Dtos;
using HMS.Patients.Services;
using HMS.Shared.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HMS.Patients.Controllers;

[ApiController]
[Authorize]
[Route("api/patients")]
public sealed class PatientsController(IPatientAppService service) : ControllerBase
{
    [HttpPost, Authorize(Roles = "ADMIN,PATIENT")]
    public async Task<IActionResult> Register([FromBody] PatientRequest r, CancellationToken ct)
    {
        var created = await service.RegisterAsync(r, ct);
        return StatusCode(201, created);
    }

    [HttpGet, Authorize(Roles = "ADMIN,DOCTOR,LAB_STAFF,PHARMACIST,BILLING_STAFF")]
    public Task<PageResponse<PatientResponse>> Search([FromQuery] string? q, [FromQuery] int page = 0, [FromQuery] int size = 20, CancellationToken ct = default)
        => service.SearchAsync(q, page, size, ct);

    [HttpGet("{id:long}")]
    public Task<PatientResponse> Get(long id, CancellationToken ct) => service.GetAuthorizedAsync(id, ct);

    /// <summary>Minimal projection for other services (HTTP twin of the gRPC contract).</summary>
    [HttpGet("{id:long}/summary")]
    public Task<PatientSummaryResponse> Summary(long id, CancellationToken ct) => service.SummaryAsync(id, ct);

    [HttpGet("by-user/{userId:long}")]
    public Task<PatientSummaryResponse> ByUser(long userId, CancellationToken ct) => service.SummaryByUserAsync(userId, ct);

    [HttpGet("by-user/{userId:long}/profile")]
    public Task<PatientResponse> ProfileByUser(long userId, CancellationToken ct) => service.ByUserAuthorizedAsync(userId, ct);

    [HttpPut("{id:long}"), Authorize(Roles = "ADMIN,PATIENT")]
    public Task<PatientResponse> Update(long id, [FromBody] PatientRequest r, CancellationToken ct) => service.UpdateAsync(id, r, ct);

    [HttpDelete("{id:long}"), Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> Deactivate(long id, CancellationToken ct)
    {
        await service.DeactivateAsync(id, ct);
        return NoContent();
    }
}
