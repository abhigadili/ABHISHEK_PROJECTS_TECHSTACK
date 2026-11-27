using Asp.Versioning;
using HR.Common.Common;
using HR.Common.Hosting;
using HR.Common.Security;
using HR.ExitService.DTOs;
using HR.ExitService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HR.ExitService.Controllers;

[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/exit")]
[Authorize]
public sealed class ExitController(IResignationService resignations, IExitTasksService tasks, ISettlementService settlements) : HrControllerBase
{
    [HttpPost("resignations"), HasPermission(Perm.SelfService), Idempotent] public async Task<IActionResult> Submit(ResignRequest r, CancellationToken ct) => StatusCode(201, await resignations.SubmitAsync(r, ct));
    [HttpGet("resignations")] public async Task<ActionResult<PagedResult<ResignationDto>>> List([FromQuery] ResignationListQuery q, CancellationToken ct) => Ok(await resignations.ListAsync(q, ct));
    [HttpGet("resignations/me")] public async Task<ActionResult<ResignationDetailDto?>> Mine(CancellationToken ct) => Ok(await resignations.MineAsync(ct));
    [HttpGet("resignations/{id}")] public async Task<ActionResult<ResignationDetailDto>> Get(string id, CancellationToken ct) => Ok(await resignations.GetAsync(id, ct));
    [HttpPost("resignations/{id}/manager-approve"), HasPermission(Perm.ExitApprove)] public async Task<ActionResult<ResignationDetailDto>> Approve(string id, DecisionRequest r, CancellationToken ct) => Ok(await resignations.ManagerDecisionAsync(id, true, r.Comment, ct));
    [HttpPost("resignations/{id}/manager-reject"), HasPermission(Perm.ExitApprove)] public async Task<ActionResult<ResignationDetailDto>> Reject(string id, RejectRequest r, CancellationToken ct) => Ok(await resignations.ManagerDecisionAsync(id, false, r.Comment, ct));
    [HttpPost("resignations/{id}/hr-confirm"), HasPermission(Perm.ExitManage)] public async Task<ActionResult<ResignationDetailDto>> HrConfirm(string id, HrConfirmRequest r, CancellationToken ct) => Ok(await resignations.HrConfirmAsync(id, r, ct));
    [HttpPost("resignations/{id}/withdraw"), HasPermission(Perm.SelfService)] public async Task<ActionResult<ResignationDetailDto>> Withdraw(string id, WithdrawRequest r, CancellationToken ct) => Ok(await resignations.WithdrawAsync(id, r.Reason, ct));

    [HttpGet("resignations/{id}/tasks")] public async Task<ActionResult<List<TaskDto>>> Tasks(string id, CancellationToken ct) => Ok(await tasks.ListAsync(id, ct));
    [HttpPost("resignations/{id}/tasks"), HasPermission(Perm.ExitManage)] public async Task<IActionResult> AddTask(string id, AddTaskRequest r, CancellationToken ct) => StatusCode(201, await tasks.AddTaskAsync(id, r, ct));
    [HttpPost("resignations/{id}/tasks/{taskId}/complete")] public async Task<ActionResult<ResignationDetailDto>> Complete(string id, string taskId, CompleteTaskRequest r, CancellationToken ct) => Ok(await tasks.CompleteAsync(id, taskId, r, ct));

    [HttpGet("interview-forms"), HasPermission(Perm.ExitManage)] public async Task<ActionResult<List<InterviewFormDto>>> Forms(CancellationToken ct) => Ok(await tasks.ListFormsAsync(ct));
    [HttpPost("interview-forms"), HasPermission(Perm.ExitManage)] public async Task<IActionResult> CreateForm(InterviewFormRequest r, CancellationToken ct) => StatusCode(201, await tasks.CreateFormAsync(r, ct));
    [HttpPut("interview-forms/{id}"), HasPermission(Perm.ExitManage)] public async Task<ActionResult<InterviewFormDto>> UpdateForm(string id, InterviewFormUpdateRequest r, CancellationToken ct) => Ok(await tasks.UpdateFormAsync(id, r, ct));
    [HttpPost("resignations/{id}/interview"), HasPermission(Perm.ExitManage)] public async Task<IActionResult> Schedule(string id, ScheduleInterviewRequest r, CancellationToken ct) => StatusCode(201, await tasks.ScheduleAsync(id, r, ct));
    [HttpPost("resignations/{id}/interview/complete"), HasPermission(Perm.ExitManage)] public async Task<ActionResult<ResignationDetailDto>> CompleteInterview(string id, CompleteInterviewRequest r, CancellationToken ct) => Ok(await tasks.CompleteInterviewAsync(id, r, ct));

    [HttpPost("resignations/{id}/settlement/calculate"), HasPermission(Perm.ExitManage)] public async Task<ActionResult<SettlementDto?>> Calculate(string id, CancellationToken ct) => Ok(await settlements.CalculateAsync(id, ct));
    [HttpPost("resignations/{id}/settlement/lines"), HasPermission(Perm.ExitManage)] public async Task<ActionResult<SettlementDto?>> AddLine(string id, SettlementLineRequest r, CancellationToken ct) => Ok(await settlements.AddLineAsync(id, r, ct));
    [HttpGet("resignations/{id}/settlement")] public async Task<ActionResult<SettlementDto?>> Settlement(string id, CancellationToken ct) => Ok(await settlements.ViewAsync(id, ct));
    [HttpPost("resignations/{id}/settlement/process"), HasPermission(Perm.PayrollProcess)] public async Task<ActionResult<ResignationDetailDto>> Process(string id, ProcessSettlementRequest r, CancellationToken ct) => Ok(await settlements.ProcessAsync(id, r.PaymentReference, ct));

    [HttpGet("policy"), HasPermission(Perm.ExitManage)] public async Task<ActionResult<PolicyDto>> Policy(CancellationToken ct) => Ok(await resignations.GetPolicyAsync(ct));
    [HttpPut("policy"), HasPermission(Perm.ExitManage)] public async Task<ActionResult<PolicyDto>> UpdatePolicy(PolicyRequest r, CancellationToken ct) => Ok(await resignations.UpdatePolicyAsync(r, ct));
}
