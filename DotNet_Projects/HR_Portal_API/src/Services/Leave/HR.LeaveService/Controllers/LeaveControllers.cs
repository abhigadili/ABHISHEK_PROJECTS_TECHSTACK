using Asp.Versioning;
using HR.Common.Common;
using HR.Common.Crud;
using HR.Common.Hosting;
using HR.Common.Security;
using HR.LeaveService.DTOs;
using HR.LeaveService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HR.LeaveService.Controllers;

[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/leaves")]
[Authorize]
public sealed class LeavesController(ILeaveApplicationService leaves) : HrControllerBase
{
    [HttpPost, HasPermission(Perm.SelfService), Idempotent]
    public async Task<IActionResult> Apply(ApplyLeaveRequest r, CancellationToken ct)
    {
        var d = await leaves.ApplyAsync(r, ct);
        return CreatedAtAction(nameof(Get), new { id = d.Application.Id, version = "1" }, d);
    }

    [HttpGet] public async Task<ActionResult<PagedResult<LeaveApplicationDto>>> List([FromQuery] LeaveListQuery q, CancellationToken ct) => Ok(await leaves.ListAsync(q, ct));

    [HttpGet("pending-approvals"), HasPermission(Perm.LeaveApprove, Perm.LeavePolicyManage)]
    public async Task<ActionResult<List<LeaveApplicationDto>>> Pending(CancellationToken ct) => Ok(await leaves.PendingApprovalsAsync(ct));

    [HttpGet("calendar")] public async Task<ActionResult<List<CalendarEntryDto>>> Calendar([FromQuery] CalendarQuery q, CancellationToken ct) => Ok(await leaves.CalendarAsync(q.From!.Value, q.To!.Value, q.EmployeeId, ct));

    [HttpGet("calendar/team"), HasPermission(Perm.LeaveApprove, Perm.LeavePolicyManage)]
    public async Task<ActionResult<List<CalendarEntryDto>>> TeamCalendar([FromQuery] CalendarQuery q, CancellationToken ct) => Ok(await leaves.TeamCalendarAsync(q.From!.Value, q.To!.Value, ct));

    [HttpGet("upcoming"), HasPermission(Perm.LeaveApprove, Perm.LeavePolicyManage)]
    public async Task<ActionResult<List<CalendarEntryDto>>> Upcoming([FromQuery] int days = 14, CancellationToken ct = default) => Ok(await leaves.UpcomingAsync(Math.Clamp(days, 1, 90), ct));

    [HttpGet("overview")]
    public async Task<ActionResult<LeaveOverviewDto>> Overview([FromQuery] YearQuery q, [FromServices] ICurrentUser user, CancellationToken ct) =>
        Ok(await leaves.OverviewAsync(user.EmployeeId ?? throw new ForbiddenException("Your account is not linked to an employee"), q.Year ?? DateTime.UtcNow.Year, ct));

    [HttpGet("summary/{employeeId}/{month}"), HasPermission(Perm.LeavePolicyManage, Perm.PayrollProcess)]
    public async Task<ActionResult<LeaveMonthlySummaryDto>> Monthly(string employeeId, string month, CancellationToken ct) => Ok(await leaves.MonthlySummaryAsync(employeeId, month, ct));

    [HttpGet("{id}")] public async Task<ActionResult<LeaveDetailDto>> Get(string id, CancellationToken ct) => Ok(await leaves.GetAsync(id, ct));
    [HttpPut("{id}")] public async Task<ActionResult<LeaveDetailDto>> Update(string id, UpdateLeaveRequest r, CancellationToken ct) => Ok(await leaves.UpdateAsync(id, r, ct));

    [HttpPost("{id}/approve"), HasPermission(Perm.LeaveApprove, Perm.LeavePolicyManage)]
    public async Task<ActionResult<LeaveDetailDto>> Approve(string id, DecisionRequest r, CancellationToken ct) => Ok(await leaves.ApproveAsync(id, r.Comment, ct));

    [HttpPost("{id}/reject"), HasPermission(Perm.LeaveApprove, Perm.LeavePolicyManage)]
    public async Task<ActionResult<LeaveDetailDto>> Reject(string id, RejectRequest r, CancellationToken ct) => Ok(await leaves.RejectAsync(id, r.Comment, ct));

    [HttpPost("{id}/withdraw")] public async Task<ActionResult<LeaveDetailDto>> Withdraw(string id, CancellationToken ct) => Ok(await leaves.WithdrawAsync(id, ct));
    [HttpPost("{id}/cancel-request")] public async Task<ActionResult<LeaveDetailDto>> CancelRequest(string id, CancelRequest r, CancellationToken ct) => Ok(await leaves.RequestCancellationAsync(id, r.Reason, ct));

    [HttpPost("{id}/cancel-approve"), HasPermission(Perm.LeaveApprove, Perm.LeavePolicyManage)]
    public async Task<ActionResult<LeaveDetailDto>> CancelApprove(string id, DecisionRequest r, CancellationToken ct) => Ok(await leaves.DecideCancellationAsync(id, true, r.Comment, ct));

    [HttpPost("{id}/cancel-reject"), HasPermission(Perm.LeaveApprove, Perm.LeavePolicyManage)]
    public async Task<ActionResult<LeaveDetailDto>> CancelReject(string id, DecisionRequest r, CancellationToken ct) => Ok(await leaves.DecideCancellationAsync(id, false, r.Comment, ct));

    [HttpPost("{id}/comments")] public async Task<IActionResult> Comment(string id, CommentRequest r, CancellationToken ct) => StatusCode(201, await leaves.AddCommentAsync(id, r.Comment, ct));
    [HttpPost("{id}/attachments")] public async Task<IActionResult> Attach(string id, AttachmentRef r, CancellationToken ct) => StatusCode(201, await leaves.AddAttachmentAsync(id, r, ct));
}

[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/leaves/balances")]
[Authorize]
public sealed class LeaveBalancesController(IBalanceService balances, ICurrentUser user) : HrControllerBase
{
    [HttpGet("me")]
    public async Task<ActionResult<List<BalanceDto>>> Mine([FromQuery] YearQuery q, CancellationToken ct) =>
        Ok(await balances.ForEmployeeAsync(user.EmployeeId ?? throw new ForbiddenException("Your account is not linked to an employee"), q.Year ?? DateTime.UtcNow.Year, ct));

    [HttpGet("{employeeId}")]
    public async Task<ActionResult<List<BalanceDto>>> ForEmployee(string employeeId, [FromQuery] YearQuery q, CancellationToken ct) => Ok(await balances.ForEmployeeAuthorizedAsync(employeeId, q.Year ?? DateTime.UtcNow.Year, ct));

    [HttpGet("{employeeId}/history")]
    public async Task<ActionResult<List<BalanceHistoryDto>>> History(string employeeId, [FromQuery] YearQuery q, CancellationToken ct)
    {
        user.EnsureSelfOr(employeeId, Perm.LeavePolicyManage);
        return Ok(await balances.HistoryAsync(employeeId, q.Year, ct));
    }

    [HttpGet("{employeeId}/reconcile"), HasPermission(Perm.LeavePolicyManage)]
    public async Task<ActionResult<List<Dictionary<string, object?>>>> Reconcile(string employeeId, [FromQuery] YearQuery q, CancellationToken ct) => Ok(await balances.ReconcileAsync(employeeId, q.Year ?? DateTime.UtcNow.Year, ct));

    [HttpPost("adjust"), HasPermission(Perm.LeavePolicyManage)]
    public async Task<ActionResult<List<BalanceDto>>> Adjust(AdjustBalanceRequest r, CancellationToken ct) => Ok(await balances.AdjustAsync(r, ct));

    [HttpPost("encash"), HasPermission(Perm.LeavePolicyManage)]
    public async Task<ActionResult<List<BalanceDto>>> Encash(EncashRequest r, CancellationToken ct) => Ok(await balances.EncashAsync(r, ct));

    [HttpPost("accrual/run"), HasPermission(Perm.LeavePolicyManage)]
    public async Task<ActionResult<RunResultDto>> Accrual(AccrualRunRequest r, CancellationToken ct) => Ok(await balances.RunAccrualAsync(r.Year, r.Month, ct));

    [HttpPost("carry-forward/run"), HasPermission(Perm.LeavePolicyManage)]
    public async Task<ActionResult<RunResultDto>> CarryForward(YearRunRequest r, CancellationToken ct) => Ok(await balances.CarryForwardAsync(r.Year, ct));
}

[ApiVersion("1.0"), Route("api/v{version:apiVersion}/leaves/types")]
public sealed class LeaveTypesController(ICrudService<LeaveTypeRequest, LeaveTypeDto> s, ICurrentUser u) : CrudController<LeaveTypeRequest, LeaveTypeDto>(s, u)
{ protected override string[] WritePermissions => [Perm.LeavePolicyManage]; }

[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/leaves/policies")]
[HasPermission(Perm.LeavePolicyManage)]
public sealed class LeavePoliciesController(IPolicyService policies) : HrControllerBase
{
    [HttpGet] public async Task<ActionResult<List<PolicyDto>>> List(CancellationToken ct) => Ok(await policies.ListAsync(ct));
    [HttpGet("{id}")] public async Task<ActionResult<PolicyDto>> Get(string id, CancellationToken ct) => Ok(await policies.GetAsync(id, ct));
    [HttpPost] public async Task<IActionResult> Create(PolicyRequest r, CancellationToken ct) => StatusCode(201, await policies.CreateAsync(r, ct));
    [HttpPut("{id}")] public async Task<ActionResult<PolicyDto>> Update(string id, PolicyUpdateRequest r, CancellationToken ct) => Ok(await policies.UpdateAsync(id, r, ct));
    [HttpDelete("{id}")] public async Task<IActionResult> Delete(string id, CancellationToken ct) { await policies.DeleteAsync(id, ct); return NoContent(); }
}
