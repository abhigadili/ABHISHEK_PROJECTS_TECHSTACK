using Asp.Versioning;
using HR.Common.Common;
using HR.Common.Hosting;
using HR.Common.Security;
using HR.EmployeeService.DTOs;
using HR.EmployeeService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HR.EmployeeService.Controllers;

[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/employees")]
[Authorize]
public sealed class EmployeesController(IEmployeeService employees) : HrControllerBase
{
    [HttpGet, HasPermission(Perm.EmployeeRead)]
    public async Task<ActionResult<PagedResult<DirectoryEntryDto>>> Directory([FromQuery] DirectoryQuery q, CancellationToken ct) => Ok(await employees.DirectoryAsync(q, ct));

    [HttpPost, HasPermission(Perm.EmployeeWrite), Idempotent]
    public async Task<IActionResult> Onboard(OnboardEmployeeRequest req, CancellationToken ct)
    {
        var p = await employees.OnboardAsync(req, ct);
        return CreatedAtAction(nameof(Get), new { id = p.Id, version = "1" }, p);
    }

    [HttpGet("me")]
    public async Task<ActionResult<EmployeeProfileDto>> Me(CancellationToken ct) => Ok(await employees.MyProfileAsync(ct));

    [HttpGet("headcount"), HasPermission(Perm.EmployeeRead, Perm.ReportView)]
    public async Task<ActionResult<List<HeadcountDto>>> Headcount(CancellationToken ct) => Ok(await employees.HeadcountAsync(ct));

    [HttpGet("{id}")]
    public async Task<ActionResult<EmployeeProfileDto>> Get(string id, CancellationToken ct) => Ok(await employees.ProfileAsync(id, ct));

    [HttpGet("{id}/summary")]
    public async Task<ActionResult<EmployeeSummaryDto>> Summary(string id, CancellationToken ct) => Ok(await employees.SummaryAsync(id, ct));

    [HttpPatch("{id}")]
    public async Task<ActionResult<EmployeeProfileDto>> Update(string id, UpdateEmployeeRequest req, CancellationToken ct) => Ok(await employees.UpdateAsync(id, req, ct));

    [HttpPost("{id}/status"), HasPermission(Perm.EmployeeWrite)]
    public async Task<ActionResult<EmployeeSummaryDto>> ChangeStatus(string id, ChangeStatusRequest req, CancellationToken ct) => Ok(await employees.ChangeStatusAsync(id, req, ct));

    [HttpDelete("{id}"), HasPermission(Perm.EmployeeWrite)]
    public async Task<IActionResult> Delete(string id, CancellationToken ct) { await employees.DeleteAsync(id, ct); return NoContent(); }

    [HttpGet("{id}/team")]
    public async Task<ActionResult<List<TeamMemberDto>>> Team(string id, CancellationToken ct) => Ok(await employees.TeamAsync(id, ct));

    [HttpGet("{id}/history/employment")]
    public async Task<ActionResult<List<EmploymentHistoryDto>>> EmploymentHistory(string id, CancellationToken ct) => Ok(await employees.EmploymentHistoryAsync(id, ct));

    [HttpGet("{id}/history/profile-changes"), HasPermission(Perm.EmployeeWrite, Perm.AuditView)]
    public async Task<ActionResult<List<ProfileChangeDto>>> ProfileChanges(string id, CancellationToken ct) => Ok(await employees.ProfileChangesAsync(id, ct));

    [HttpGet("{id}/history/status"), HasPermission(Perm.EmployeeRead)]
    public async Task<ActionResult<List<StatusHistoryDto>>> StatusHistory(string id, CancellationToken ct) => Ok(await employees.StatusHistoryAsync(id, ct));
}
