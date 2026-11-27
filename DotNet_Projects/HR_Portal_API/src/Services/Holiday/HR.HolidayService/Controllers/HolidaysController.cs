using Asp.Versioning;
using HR.Common.Hosting;
using HR.Common.Security;
using HR.HolidayService.DTOs;
using HR.HolidayService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HR.HolidayService.Controllers;

[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/holidays")]
[Authorize]
public sealed class HolidaysController(IHolidayService holidays) : HrControllerBase
{
    [HttpGet] public async Task<ActionResult<List<HolidayDto>>> List([FromQuery] HolidayQuery q, CancellationToken ct) => Ok(await holidays.ListAsync(q, ct));
    [HttpGet("calendar")] public async Task<ActionResult<CalendarDto>> Calendar([FromQuery] HolidayQuery q, CancellationToken ct) => Ok(await holidays.CalendarAsync(q, ct));
    [HttpGet("upcoming")] public async Task<ActionResult<List<HolidayDto>>> Upcoming([FromQuery] UpcomingQuery q, CancellationToken ct) => Ok(await holidays.UpcomingAsync(q, ct));
    [HttpGet("count")] public async Task<ActionResult<HolidayCountDto>> Count([FromQuery] CountQuery q, CancellationToken ct) => Ok(await holidays.CountAsync(q, ct));
    [HttpGet("years")] public async Task<ActionResult<List<HolidayYearDto>>> Years(CancellationToken ct) => Ok(await holidays.ListYearsAsync(ct));

    [HttpPost("years"), HasPermission(Perm.HolidayManage)]
    public async Task<IActionResult> CreateYear(HolidayYearRequest r, CancellationToken ct) => StatusCode(201, await holidays.CreateYearAsync(r, ct));

    [HttpPut("years/{id}"), HasPermission(Perm.HolidayManage)]
    public async Task<ActionResult<HolidayYearDto>> UpdateYear(string id, HolidayYearUpdateRequest r, CancellationToken ct) => Ok(await holidays.UpdateYearAsync(id, r, ct));

    [HttpGet("{id}")] public async Task<ActionResult<HolidayDto>> Get(string id, CancellationToken ct) => Ok(await holidays.GetAsync(id, ct));

    [HttpPost, HasPermission(Perm.HolidayManage)]
    public async Task<IActionResult> Create(HolidayRequest r, CancellationToken ct)
    {
        var h = await holidays.CreateAsync(r, ct);
        return CreatedAtAction(nameof(Get), new { id = h.Id, version = "1" }, h);
    }

    [HttpPut("{id}"), HasPermission(Perm.HolidayManage)]
    public async Task<ActionResult<HolidayDto>> Update(string id, HolidayUpdateRequest r, CancellationToken ct) => Ok(await holidays.UpdateAsync(id, r, ct));

    [HttpDelete("{id}"), HasPermission(Perm.HolidayManage)]
    public async Task<IActionResult> Delete(string id, CancellationToken ct) { await holidays.DeleteAsync(id, ct); return NoContent(); }
}
