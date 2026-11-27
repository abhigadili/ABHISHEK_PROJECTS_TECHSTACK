using Asp.Versioning;
using HR.Common.Common;
using HR.Common.Hosting;
using HR.Common.Security;
using HR.TimesheetService.DTOs;
using HR.TimesheetService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HR.TimesheetService.Controllers;

[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/timesheets")]
[Authorize]
public sealed class TimesheetsController(ITimesheetService svc) : HrControllerBase
{
    [HttpGet] public async Task<ActionResult<PagedResult<TimesheetDto>>> List([FromQuery] TimesheetListQuery q, CancellationToken ct) => Ok(await svc.ListAsync(q, ct));
    [HttpGet("pending-approvals"), HasPermission(Perm.TimesheetApprove)] public async Task<ActionResult<List<TimesheetDto>>> Pending(CancellationToken ct) => Ok(await svc.PendingApprovalsAsync(ct));
    [HttpGet("week/{weekStart}")] public async Task<ActionResult<TimesheetViewDto>> MyWeek(DateOnly weekStart, CancellationToken ct) => Ok(await svc.GetWeekAsync(null, weekStart, ct));
    [HttpPut("week/{weekStart}"), HasPermission(Perm.SelfService)] public async Task<ActionResult<TimesheetViewDto>> SaveWeek(DateOnly weekStart, SaveWeekRequest r, CancellationToken ct) => Ok(await svc.SaveWeekAsync(weekStart, r.Entries, ct));
    [HttpGet("employee/{employeeId}/week/{weekStart}")] public async Task<ActionResult<TimesheetViewDto>> EmployeeWeek(string employeeId, DateOnly weekStart, CancellationToken ct) => Ok(await svc.GetWeekAsync(employeeId, weekStart, ct));

    [HttpGet("reports/employee-hours")] public async Task<ActionResult<EmployeeHoursSummaryDto>> EmployeeHours([FromQuery] RangeQuery q, [FromServices] ICurrentUser u, CancellationToken ct) =>
        Ok(await svc.EmployeeSummaryAsync(q.EmployeeId ?? u.EmployeeId ?? throw new ForbiddenException("Your account is not linked to an employee"), q.From!.Value, q.To!.Value, ct));
    [HttpGet("reports/project-hours/{projectId}")] public async Task<ActionResult<ProjectSummaryDto>> ProjectHours(string projectId, [FromQuery] RangeQuery q, CancellationToken ct) => Ok(await svc.ProjectSummaryAsync(projectId, q.From!.Value, q.To!.Value, ct));

    [HttpGet("projects/{projectId}/tasks")] public async Task<ActionResult<List<TaskDto>>> Tasks(string projectId, CancellationToken ct) => Ok(await svc.ListTasksAsync(projectId, ct));
    [HttpPost("projects/{projectId}/tasks"), HasPermission(Perm.ProjectManage)] public async Task<IActionResult> CreateTask(string projectId, TaskRequest r, CancellationToken ct) => StatusCode(201, await svc.CreateTaskAsync(projectId, r, ct));
    [HttpPut("tasks/{id}"), HasPermission(Perm.ProjectManage)] public async Task<ActionResult<TaskDto>> UpdateTask(string id, TaskUpdateRequest r, CancellationToken ct) => Ok(await svc.UpdateTaskAsync(id, r, ct));
    [HttpDelete("entries/{entryId}"), HasPermission(Perm.SelfService)] public async Task<ActionResult<TimesheetViewDto>> DeleteEntry(string entryId, CancellationToken ct) => Ok(await svc.DeleteEntryAsync(entryId, ct));

    [HttpGet("{id}")] public async Task<ActionResult<TimesheetViewDto>> Get(string id, CancellationToken ct) => Ok(await svc.GetAsync(id, ct));
    [HttpPost("{id}/submit"), HasPermission(Perm.SelfService)] public async Task<ActionResult<TimesheetViewDto>> Submit(string id, CancellationToken ct) => Ok(await svc.SubmitAsync(id, ct));
    [HttpPost("{id}/approve"), HasPermission(Perm.TimesheetApprove)] public async Task<ActionResult<TimesheetViewDto>> Approve(string id, DecisionRequest r, CancellationToken ct) => Ok(await svc.DecideAsync(id, true, r.Comment, ct));
    [HttpPost("{id}/reject"), HasPermission(Perm.TimesheetApprove)] public async Task<ActionResult<TimesheetViewDto>> Reject(string id, RejectRequest r, CancellationToken ct) => Ok(await svc.DecideAsync(id, false, r.Comment, ct));
    [HttpPost("{id}/reopen")] public async Task<ActionResult<TimesheetViewDto>> Reopen(string id, ReopenRequest r, CancellationToken ct) => Ok(await svc.ReopenAsync(id, r.Reason, ct));
}
