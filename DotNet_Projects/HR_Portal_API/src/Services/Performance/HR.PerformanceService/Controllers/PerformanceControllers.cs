using Asp.Versioning;
using HR.Common.Common;
using HR.Common.Hosting;
using HR.Common.Security;
using HR.PerformanceService.DTOs;
using HR.PerformanceService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HR.PerformanceService.Controllers;

[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/performance")]
[Authorize]
public sealed class PerformanceReviewsController(IReviewService reviews) : HrControllerBase
{
    [HttpGet("forms")] public async Task<ActionResult<List<FormDto>>> Forms(CancellationToken ct) => Ok(await reviews.ListFormsAsync(ct));
    [HttpGet("forms/{id}")] public async Task<ActionResult<FormDto>> Form(string id, CancellationToken ct) => Ok(await reviews.GetFormAsync(id, ct));
    [HttpPost("forms"), HasPermission(Perm.PerformanceManage)] public async Task<IActionResult> CreateForm(FormRequest r, CancellationToken ct) => StatusCode(201, await reviews.CreateFormAsync(r, ct));
    [HttpPut("forms/{id}"), HasPermission(Perm.PerformanceManage)] public async Task<ActionResult<FormDto>> UpdateForm(string id, FormUpdateRequest r, CancellationToken ct) => Ok(await reviews.UpdateFormAsync(id, r, ct));

    [HttpGet("cycles")] public async Task<ActionResult<List<CycleDto>>> Cycles([FromQuery] string? status, CancellationToken ct) => Ok(await reviews.ListCyclesAsync(status, ct));
    [HttpPost("cycles"), HasPermission(Perm.PerformanceManage)] public async Task<IActionResult> CreateCycle(CycleRequest r, CancellationToken ct) => StatusCode(201, await reviews.CreateCycleAsync(r, ct));
    [HttpPost("cycles/{id}/activate"), HasPermission(Perm.PerformanceManage)] public async Task<ActionResult<ActivateResultDto>> Activate(string id, CancellationToken ct) => Ok(await reviews.ActivateCycleAsync(id, ct));
    [HttpPost("cycles/{id}/close"), HasPermission(Perm.PerformanceManage)] public async Task<ActionResult<CloseResultDto>> Close(string id, CancellationToken ct) => Ok(await reviews.CloseCycleAsync(id, ct));
    [HttpPost("cycles/{id}/reminders"), HasPermission(Perm.PerformanceManage)] public async Task<ActionResult<ReminderResultDto>> Reminders(string id, CancellationToken ct) => Ok(await reviews.SendRemindersAsync(id, ct));
    [HttpGet("cycles/{id}/report"), HasPermission(Perm.PerformanceManage, Perm.ReportView)] public async Task<ActionResult<CycleReportDto>> Report(string id, CancellationToken ct) => Ok(await reviews.CycleReportAsync(id, ct));

    [HttpGet("reviews")] public async Task<ActionResult<PagedResult<ReviewSummaryDto>>> List([FromQuery] ReviewListQuery q, CancellationToken ct) => Ok(await reviews.ListAsync(q, ct));
    [HttpGet("reviews/me")] public async Task<ActionResult<ReviewDetailDto?>> Mine(CancellationToken ct) => Ok(await reviews.MyCurrentAsync(ct));
    [HttpGet("reviews/employee/{employeeId}/history")] public async Task<ActionResult<List<EmployeeReviewHistoryDto>>> History(string employeeId, CancellationToken ct) => Ok(await reviews.EmployeeHistoryAsync(employeeId, ct));
    [HttpGet("reviews/{id}")] public async Task<ActionResult<ReviewDetailDto>> Get(string id, CancellationToken ct) => Ok(await reviews.GetAsync(id, ct));
    [HttpPut("reviews/{id}/self"), HasPermission(Perm.SelfService)] public async Task<ActionResult<ReviewDetailDto>> SaveSelf(string id, AnswersRequest r, CancellationToken ct) => Ok(await reviews.SaveAnswersAsync(id, "SELF", r.Answers, ct));
    [HttpPost("reviews/{id}/self/submit"), HasPermission(Perm.SelfService)] public async Task<ActionResult<ReviewDetailDto>> SubmitSelf(string id, SelfSubmitRequest r, CancellationToken ct) => Ok(await reviews.SubmitSelfAsync(id, r, ct));
    [HttpPut("reviews/{id}/manager"), HasPermission(Perm.PerformanceReview)] public async Task<ActionResult<ReviewDetailDto>> SaveManager(string id, AnswersRequest r, CancellationToken ct) => Ok(await reviews.SaveAnswersAsync(id, "MANAGER", r.Answers, ct));
    [HttpPost("reviews/{id}/manager/submit"), HasPermission(Perm.PerformanceReview)] public async Task<ActionResult<ReviewDetailDto>> SubmitManager(string id, ManagerSubmitRequest r, CancellationToken ct) => Ok(await reviews.SubmitManagerAsync(id, r, ct));
    [HttpPost("reviews/{id}/approve"), HasPermission(Perm.PerformanceManage)] public async Task<ActionResult<ReviewDetailDto>> Approve(string id, ApproveReviewRequest r, CancellationToken ct) => Ok(await reviews.ApproveAsync(id, r, ct));
}

[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/performance")]
[Authorize]
public sealed class GoalsController(IGoalService goals) : HrControllerBase
{
    [HttpGet("goals")] public async Task<ActionResult<List<GoalDto>>> List([FromQuery] GoalListQuery q, CancellationToken ct) => Ok(await goals.ListAsync(q, ct));
    [HttpPost("goals"), HasPermission(Perm.SelfService)] public async Task<IActionResult> Create(GoalRequest r, CancellationToken ct) => StatusCode(201, await goals.CreateAsync(r, ct));
    [HttpPut("goals/{id}")] public async Task<ActionResult<GoalDto>> Update(string id, GoalUpdateRequest r, CancellationToken ct) => Ok(await goals.UpdateAsync(id, r, ct));
    [HttpDelete("goals/{id}")] public async Task<IActionResult> Delete(string id, CancellationToken ct) { await goals.DeleteAsync(id, ct); return NoContent(); }
    [HttpPost("goals/{id}/key-results")] public async Task<IActionResult> AddKr(string id, KeyResultRequest r, CancellationToken ct) => StatusCode(201, await goals.AddKeyResultAsync(id, r, ct));
    [HttpPut("goals/{id}/key-results/{krId}")] public async Task<ActionResult<KeyResultDto>> UpdateKr(string id, string krId, KeyResultUpdateRequest r, CancellationToken ct) => Ok(await goals.UpdateKeyResultAsync(id, krId, r, ct));
    [HttpPost("feedback"), HasPermission(Perm.SelfService)] public async Task<IActionResult> Feedback(FeedbackRequest r, CancellationToken ct) => StatusCode(201, await goals.GiveFeedbackAsync(r, ct));
    [HttpGet("feedback/{employeeId}")] public async Task<ActionResult<List<FeedbackDto>>> FeedbackFor(string employeeId, CancellationToken ct) => Ok(await goals.FeedbackForAsync(employeeId, ct));
}
