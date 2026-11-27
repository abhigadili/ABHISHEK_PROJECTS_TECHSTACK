using Asp.Versioning;
using HR.Common.Common;
using HR.Common.Crud;
using HR.Common.Hosting;
using HR.Common.Security;
using HR.PayrollService.DTOs;
using HR.PayrollService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HR.PayrollService.Controllers;

[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/payroll")]
[Authorize]
public sealed class PayrollConfigController(ISalaryService salary) : HrControllerBase
{
    [HttpGet("config"), HasPermission(Perm.PayrollView)] public async Task<ActionResult<List<ConfigDto>>> Config(CancellationToken ct) => Ok(await salary.ListConfigAsync(ct));
    [HttpPut("config"), HasPermission(Perm.SalaryManage)] public async Task<ActionResult<List<ConfigDto>>> UpdateConfig(UpdateConfigRequest r, CancellationToken ct) => Ok(await salary.UpdateConfigAsync(r, ct));

    [HttpGet("structures"), HasPermission(Perm.PayrollView)] public async Task<ActionResult<List<StructureDto>>> Structures(CancellationToken ct) => Ok(await salary.ListStructuresAsync(ct));
    [HttpGet("structures/{id}"), HasPermission(Perm.PayrollView)] public async Task<ActionResult<StructureDto>> Structure(string id, CancellationToken ct) => Ok(await salary.GetStructureAsync(id, ct));
    [HttpPost("structures"), HasPermission(Perm.SalaryManage)] public async Task<IActionResult> CreateStructure(StructureRequest r, CancellationToken ct) => StatusCode(201, await salary.CreateStructureAsync(r, ct));
    [HttpPut("structures/{id}"), HasPermission(Perm.SalaryManage)] public async Task<ActionResult<StructureDto>> UpdateStructure(string id, StructureUpdateRequest r, CancellationToken ct) => Ok(await salary.UpdateStructureAsync(id, r, ct));

    [HttpPost("salaries"), HasPermission(Perm.SalaryManage)] public async Task<IActionResult> Assign(AssignSalaryRequest r, CancellationToken ct) => StatusCode(201, await salary.AssignAsync(r, ct));
    [HttpGet("salaries/me")] public async Task<ActionResult<EmployeeSalaryDto>> Mine([FromServices] ICurrentUser u, CancellationToken ct) => Ok(await salary.EmployeeSalaryAsync(u.EmployeeId ?? throw new ForbiddenException("Your account is not linked to an employee"), ct));
    [HttpGet("salaries/employee/{employeeId}")] public async Task<ActionResult<EmployeeSalaryDto>> ForEmployee(string employeeId, CancellationToken ct) => Ok(await salary.EmployeeSalaryAsync(employeeId, ct));

    [HttpPost("revisions"), HasPermission(Perm.SalaryManage)] public async Task<IActionResult> Revise(RevisionRequest r, CancellationToken ct) => StatusCode(201, await salary.RequestRevisionAsync(r, ct));
    [HttpGet("revisions"), HasPermission(Perm.PayrollView)] public async Task<ActionResult<List<RevisionDto>>> Revisions([FromQuery] string? status, [FromQuery] string? employeeId, CancellationToken ct) => Ok(await salary.ListRevisionsAsync(status, employeeId, ct));
    [HttpPost("revisions/{id}/approve"), HasPermission(Perm.PayrollApprove)] public async Task<ActionResult<RevisionDto>> Approve(string id, DecisionRequest r, CancellationToken ct) => Ok(await salary.DecideRevisionAsync(id, true, r.Comment, ct));
    [HttpPost("revisions/{id}/reject"), HasPermission(Perm.PayrollApprove)] public async Task<ActionResult<RevisionDto>> Reject(string id, RejectRequest r, CancellationToken ct) => Ok(await salary.DecideRevisionAsync(id, false, r.Comment, ct));
}

[ApiVersion("1.0"), Route("api/v{version:apiVersion}/payroll/components")]
public sealed class SalaryComponentsController(ICrudService<SalaryComponentRequest, SalaryComponentDto> s, ICurrentUser u) : CrudController<SalaryComponentRequest, SalaryComponentDto>(s, u)
{
    protected override string[] WritePermissions => [Perm.SalaryManage];
    protected override string[] ReadPermissions => [Perm.PayrollView];
}

[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/payroll")]
[Authorize]
public sealed class AdjustmentsController(IAdjustmentService svc) : HrControllerBase
{
    [HttpPost("adjustments"), HasPermission(Perm.PayrollProcess)] public async Task<IActionResult> Create(AdjustmentRequest r, CancellationToken ct) => StatusCode(201, await svc.CreateAsync(r, ct));
    [HttpGet("adjustments"), HasPermission(Perm.PayrollView)] public async Task<ActionResult<List<AdjustmentDto>>> List([FromQuery] string? employeeId, [FromQuery] string? month, CancellationToken ct) => Ok(await svc.ListAsync(employeeId, month, ct));
    [HttpDelete("adjustments/{id}"), HasPermission(Perm.PayrollProcess)] public async Task<ActionResult<AdjustmentDto>> Cancel(string id, CancellationToken ct) => Ok(await svc.CancelAsync(id, ct));

    [HttpPost("loans"), HasPermission(Perm.PayrollProcess)] public async Task<IActionResult> CreateLoan(LoanRequest r, CancellationToken ct) => StatusCode(201, await svc.CreateLoanAsync(r, ct));
    [HttpGet("loans"), HasPermission(Perm.PayrollView)] public async Task<ActionResult<List<LoanDto>>> Loans([FromQuery] string? employeeId, CancellationToken ct) => Ok(await svc.ListLoansAsync(employeeId, ct));
    [HttpPost("loans/{id}/close"), HasPermission(Perm.PayrollProcess)] public async Task<ActionResult<LoanDto>> CloseLoan(string id, CancellationToken ct) => Ok(await svc.CloseLoanAsync(id, ct));

    [HttpGet("settlement-basis/{employeeId}"), HasPermission(Perm.ExitManage, Perm.PayrollProcess)]
    public async Task<ActionResult<SettlementBasisDto>> Basis(string employeeId, CancellationToken ct) => Ok(await svc.SettlementBasisAsync(employeeId, ct) ?? throw new NotFoundException("No active salary"));

    [HttpPost("settlements"), HasPermission(Perm.PayrollProcess), Idempotent]
    public async Task<IActionResult> Settlement(SettlementPostRequest r, CancellationToken ct) => StatusCode(201, await svc.PostSettlementAsync(r, ct));
}

[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/payroll/runs")]
[Authorize]
public sealed class PayrollRunsController(IPayrollRunService runs) : HrControllerBase
{
    [HttpPost, HasPermission(Perm.PayrollProcess)] public async Task<IActionResult> Create(CreateRunRequest r, CancellationToken ct) => StatusCode(201, await runs.CreateAsync(r, ct));
    [HttpGet, HasPermission(Perm.PayrollView)] public async Task<ActionResult<PagedResult<RunDto>>> List([FromQuery] RunListQuery q, CancellationToken ct) => Ok(await runs.ListAsync(q, ct));
    [HttpGet("{id}"), HasPermission(Perm.PayrollView)] public async Task<ActionResult<RunDetailDto>> Get(string id, CancellationToken ct) => Ok(await runs.GetAsync(id, ct));
    [HttpPost("{id}/calculate"), HasPermission(Perm.PayrollProcess)] public async Task<ActionResult<CalculationResultDto>> Calculate(string id, CancellationToken ct) => Ok(await runs.CalculateAsync(id, ct));
    [HttpPost("{id}/process"), HasPermission(Perm.PayrollProcess)] public async Task<ActionResult<RunDetailDto>> Process(string id, CancellationToken ct) => Ok(await runs.ProcessAsync(id, ct));
    [HttpPost("{id}/approve"), HasPermission(Perm.PayrollApprove)] public async Task<ActionResult<RunDetailDto>> Approve(string id, CancellationToken ct) => Ok(await runs.ApproveAsync(id, ct));
    [HttpPost("{id}/finalize"), HasPermission(Perm.PayrollProcess, Perm.PayrollApprove)] public async Task<ActionResult<RunDetailDto>> Finalize(string id, CancellationToken ct) => Ok(await runs.FinalizeAsync(id, ct));
    [HttpPost("{id}/payslips/generate"), HasPermission(Perm.PayrollProcess)] public async Task<IActionResult> GeneratePayslips(string id, CancellationToken ct) => Ok(new { generated = await runs.GeneratePayslipsAsync(id, ct) });
    [HttpGet("{id}/entries"), HasPermission(Perm.PayrollView)] public async Task<ActionResult<PagedResult<EntryDto>>> Entries(string id, [FromQuery] EntryListQuery q, CancellationToken ct) => Ok(await runs.EntriesAsync(id, q, ct));
    [HttpGet("{id}/entries/{entryId}"), HasPermission(Perm.PayrollView)] public async Task<ActionResult<EntryDetailDto>> Entry(string id, string entryId, CancellationToken ct) => Ok(await runs.EntryAsync(id, entryId, ct));
    [HttpGet("{id}/report"), HasPermission(Perm.PayrollView)] public async Task<ActionResult<RunReportDto>> Report(string id, CancellationToken ct) => Ok(await runs.ReportAsync(id, ct));
}

[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/payroll")]
[Authorize]
public sealed class PayslipsController(IPayslipService payslips, IPayrollRunService runs, ICurrentUser user) : HrControllerBase
{
    [HttpGet("employees/{employeeId}/history")] public async Task<ActionResult<List<EmployeePayrollHistoryDto>>> History(string employeeId, CancellationToken ct) => Ok(await runs.EmployeeHistoryAsync(employeeId, ct));

    [HttpGet("payslips/me")] public async Task<ActionResult<List<PayslipDto>>> Mine([FromQuery] YearQuery q, CancellationToken ct) =>
        Ok(await payslips.ListForEmployeeAsync(user.EmployeeId ?? throw new ForbiddenException("Your account is not linked to an employee"), q.Year, ct));

    [HttpGet("payslips/me/latest")] public async Task<ActionResult<PayslipDto?>> Latest(CancellationToken ct) =>
        Ok(await payslips.LatestAsync(user.EmployeeId ?? throw new ForbiddenException("Your account is not linked to an employee"), ct));

    [HttpGet("payslips/employee/{employeeId}")] public async Task<ActionResult<List<PayslipDto>>> ForEmployee(string employeeId, [FromQuery] YearQuery q, CancellationToken ct) => Ok(await payslips.ListForEmployeeAsync(employeeId, q.Year, ct));

    [HttpGet("payslips/{id}/download")]
    public async Task<IActionResult> Download(string id, CancellationToken ct)
    {
        var (stream, name, _) = await payslips.OpenAsync(id, ct);
        return File(stream, "application/pdf", name);
    }
}
