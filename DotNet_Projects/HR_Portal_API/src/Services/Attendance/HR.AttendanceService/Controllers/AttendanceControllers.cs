using Asp.Versioning;
using HR.AttendanceService.DTOs;
using HR.AttendanceService.Services;
using HR.Common.Common;
using HR.Common.Crud;
using HR.Common.Hosting;
using HR.Common.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HR.AttendanceService.Controllers;

[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/attendance")]
[Authorize]
public sealed class AttendanceController(IAttendanceService attendance) : HrControllerBase
{
    [HttpPost("check-in"), HasPermission(Perm.SelfService)] public async Task<ActionResult<AttendanceRecordDto>> CheckIn(CheckInRequest r, CancellationToken ct) => Ok(await attendance.CheckInAsync(r, ct));
    [HttpPost("check-out"), HasPermission(Perm.SelfService)] public async Task<ActionResult<AttendanceRecordDto>> CheckOut(CheckOutRequest r, CancellationToken ct) => Ok(await attendance.CheckOutAsync(r, ct));
    [HttpGet("today")] public async Task<ActionResult<TodayDto>> Today(CancellationToken ct) => Ok(await attendance.TodayAsync(ct));
    [HttpGet("records")] public async Task<ActionResult<PagedResult<AttendanceRecordDto>>> Records([FromQuery] RecordsQuery q, CancellationToken ct) => Ok(await attendance.ListAsync(q, ct));
    [HttpGet("monthly")] public async Task<ActionResult<MonthlyDto>> Monthly([FromQuery] MonthQuery q, CancellationToken ct) => Ok(await attendance.MonthlyAsync(q, ct));
    [HttpGet("calendar")] public async Task<ActionResult<List<CalendarDayDto>>> Calendar([FromQuery] MonthQuery q, CancellationToken ct) => Ok(await attendance.CalendarAsync(q, ct));

    [HttpGet("team"), HasPermission(Perm.AttendanceApprove, Perm.AttendanceManage)]
    public async Task<ActionResult<TeamReportDto>> Team([FromQuery] TeamQuery q, CancellationToken ct) => Ok(await attendance.TeamReportAsync(q, ct));

    [HttpGet("payroll-input"), HasPermission(Perm.AttendanceManage, Perm.PayrollProcess)]
    public async Task<ActionResult<PayrollInputDto>> PayrollInput([FromQuery] PayrollInputQuery q, CancellationToken ct) => Ok(await attendance.PayrollInputAsync(q.EmployeeId, q.Month, ct));

    [HttpPost("missing-punches/mark"), HasPermission(Perm.AttendanceManage)]
    public async Task<IActionResult> MarkMissing(CancellationToken ct) => Ok(new { flagged = await attendance.MarkMissingPunchesAsync(ct) });
}

[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/attendance/corrections")]
[Authorize]
public sealed class CorrectionsController(ICorrectionService svc) : HrControllerBase
{
    [HttpPost, HasPermission(Perm.SelfService)] public async Task<IActionResult> Request(CorrectionRequestDto r, CancellationToken ct) => StatusCode(201, await svc.RequestAsync(r, ct));
    [HttpGet] public async Task<ActionResult<PagedResult<CorrectionDto>>> List([FromQuery] RequestListQuery q, CancellationToken ct) => Ok(await svc.ListAsync(q, ct));
    [HttpPost("{id}/approve"), HasPermission(Perm.AttendanceApprove, Perm.AttendanceManage)] public async Task<ActionResult<CorrectionDto>> Approve(string id, DecisionRequest r, CancellationToken ct) => Ok(await svc.DecideAsync(id, true, r.Comment, ct));
    [HttpPost("{id}/reject"), HasPermission(Perm.AttendanceApprove, Perm.AttendanceManage)] public async Task<ActionResult<CorrectionDto>> Reject(string id, RejectRequest r, CancellationToken ct) => Ok(await svc.DecideAsync(id, false, r.Comment, ct));
    [HttpPost("{id}/cancel")] public async Task<ActionResult<CorrectionDto>> Cancel(string id, CancellationToken ct) => Ok(await svc.CancelAsync(id, ct));
}

[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/attendance/wfh")]
[Authorize]
public sealed class WfhController(IWfhService svc) : HrControllerBase
{
    [HttpPost, HasPermission(Perm.SelfService)] public async Task<IActionResult> Request(WfhRequestDto r, CancellationToken ct) => StatusCode(201, await svc.RequestAsync(r, ct));
    [HttpGet] public async Task<ActionResult<PagedResult<WfhDto>>> List([FromQuery] RequestListQuery q, CancellationToken ct) => Ok(await svc.ListAsync(q, ct));
    [HttpPost("{id}/approve"), HasPermission(Perm.AttendanceApprove, Perm.AttendanceManage)] public async Task<ActionResult<WfhDto>> Approve(string id, DecisionRequest r, CancellationToken ct) => Ok(await svc.DecideAsync(id, true, r.Comment, ct));
    [HttpPost("{id}/reject"), HasPermission(Perm.AttendanceApprove, Perm.AttendanceManage)] public async Task<ActionResult<WfhDto>> Reject(string id, RejectRequest r, CancellationToken ct) => Ok(await svc.DecideAsync(id, false, r.Comment, ct));
    [HttpPost("{id}/cancel")] public async Task<ActionResult<WfhDto>> Cancel(string id, CancellationToken ct) => Ok(await svc.CancelAsync(id, ct));
}

[ApiVersion("1.0"), Route("api/v{version:apiVersion}/attendance/shifts")]
public sealed class ShiftsController(ICrudService<ShiftRequest, ShiftDto> s, ICurrentUser u) : CrudController<ShiftRequest, ShiftDto>(s, u)
{ protected override string[] WritePermissions => [Perm.AttendanceManage]; }

[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/attendance")]
[HasPermission(Perm.AttendanceManage)]
public sealed class ShiftAssignmentsController(IShiftAssignmentService svc) : HrControllerBase
{
    [HttpPost("shift-assignments")] public async Task<ActionResult<AssignedDto>> Assign(AssignShiftRequest r, CancellationToken ct) => Ok(await svc.AssignAsync(r, ct));
    [HttpGet("shift-assignments/{employeeId}")] public async Task<ActionResult<List<ShiftAssignmentDto>>> ForEmployee(string employeeId, CancellationToken ct) => Ok(await svc.ForEmployeeAsync(employeeId, ct));
    [HttpPost("holidays/sync")] public async Task<ActionResult<SyncResultDto>> Sync(SyncHolidaysRequest r, CancellationToken ct) => Ok(await svc.SyncHolidaysAsync(r.Year, ct));
}
