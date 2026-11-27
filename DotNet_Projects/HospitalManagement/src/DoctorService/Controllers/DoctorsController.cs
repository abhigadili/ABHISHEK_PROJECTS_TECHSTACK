using HMS.Doctors.Dtos;
using HMS.Doctors.Services;
using HMS.Shared.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HMS.Doctors.Controllers;

[ApiController, Authorize, Route("api/doctors")]
public sealed class DoctorsController(IDoctorAppService service) : ControllerBase
{
    [HttpPost, Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> Create([FromBody] DoctorRequest r, CancellationToken ct) => StatusCode(201, await service.CreateAsync(r, ct));

    [HttpGet]
    public Task<PageResponse<DoctorResponse>> Search([FromQuery] string? specialization, [FromQuery] long? hospitalId, [FromQuery] long? departmentId, [FromQuery] bool? active,
        [FromQuery] int page = 0, [FromQuery] int size = 20, CancellationToken ct = default) => service.SearchAsync(specialization, hospitalId, departmentId, active, page, size, ct);

    [HttpGet("specializations")]
    public Task<List<string>> Specializations(CancellationToken ct) => service.SpecializationsAsync(ct);

    [HttpGet("available")]
    public Task<List<AvailableDoctor>> Available([FromQuery] DateOnly date, [FromQuery] string? specialization, CancellationToken ct) => service.AvailableOnAsync(date, specialization, ct);

    [HttpGet("{id:long}")]
    public Task<DoctorResponse> Get(long id, CancellationToken ct) => service.GetAsync(id, ct);

    [HttpPut("{id:long}"), Authorize(Roles = "ADMIN")]
    public Task<DoctorResponse> Update(long id, [FromBody] DoctorRequest r, CancellationToken ct) => service.UpdateAsync(id, r, ct);

    [HttpDelete("{id:long}"), Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> Deactivate(long id, CancellationToken ct) { await service.DeactivateAsync(id, ct); return NoContent(); }

    [HttpGet("{id:long}/slots")]
    public Task<List<SlotDto>> Slots(long id, [FromQuery] DateOnly date, CancellationToken ct) => service.SlotsAsync(id, date, ct);

    [HttpGet("{id:long}/schedule")]
    public Task<List<ScheduleEntry>> Schedule(long id, CancellationToken ct) => service.ScheduleAsync(id, ct);

    [HttpPut("{id:long}/schedule"), Authorize(Roles = "ADMIN,DOCTOR")]
    public Task<List<ScheduleEntry>> ReplaceSchedule(long id, [FromBody] ScheduleRequest r, CancellationToken ct) => service.ReplaceScheduleAsync(id, r, ct);

    [HttpGet("{id:long}/unavailability")]
    public Task<List<UnavailabilityResponse>> Unavailability(long id, CancellationToken ct) => service.UnavailabilityAsync(id, ct);

    [HttpPost("{id:long}/unavailability"), Authorize(Roles = "ADMIN,DOCTOR")]
    public async Task<IActionResult> AddUnavailability(long id, [FromBody] UnavailabilityRequest r, CancellationToken ct) => StatusCode(201, await service.AddUnavailabilityAsync(id, r, ct));

    [HttpDelete("{id:long}/unavailability/{unavailabilityId:long}"), Authorize(Roles = "ADMIN,DOCTOR")]
    public async Task<IActionResult> RemoveUnavailability(long id, long unavailabilityId, CancellationToken ct) { await service.RemoveUnavailabilityAsync(id, unavailabilityId, ct); return NoContent(); }
}
