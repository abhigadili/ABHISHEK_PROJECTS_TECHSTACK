using Asp.Versioning;
using HR.Common.Common;
using HR.Common.Hosting;
using HR.Common.Security;
using HR.TaxService.DTOs;
using HR.TaxService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HR.TaxService.Controllers;

[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/tax/declarations")]
[Authorize]
public sealed class DeclarationsController(IDeclarationService svc) : HrControllerBase
{
    [HttpPost, HasPermission(Perm.SelfService)] public async Task<IActionResult> Create(CreateDeclarationRequest r, CancellationToken ct) => StatusCode(201, await svc.CreateAsync(r, ct));
    [HttpGet] public async Task<ActionResult<PagedResult<DeclarationSummaryDto>>> List([FromQuery] DeclarationListQuery q, CancellationToken ct) => Ok(await svc.ListAsync(q, ct));
    [HttpGet("me/{fy}")] public async Task<ActionResult<DeclarationDto?>> Mine(string fy, CancellationToken ct) => Ok(await svc.MineAsync(fy, ct));
    [HttpPost("reminders/{fy}"), HasPermission(Perm.TaxReview)] public async Task<ActionResult<ReminderResultDto>> Reminders(string fy, CancellationToken ct) => Ok(await svc.SendRemindersAsync(fy, ct));
    [HttpGet("{id}")] public async Task<ActionResult<DeclarationDto>> Get(string id, CancellationToken ct) => Ok(await svc.GetAsync(id, ct));
    [HttpPut("{id}/regime"), HasPermission(Perm.SelfService)] public async Task<ActionResult<DeclarationDto>> Regime(string id, RegimeRequest r, CancellationToken ct) => Ok(await svc.SetRegimeAsync(id, r.Regime, ct));
    [HttpPost("{id}/investments"), HasPermission(Perm.SelfService)] public async Task<ActionResult<DeclarationDto>> AddInvestment(string id, InvestmentRequest r, CancellationToken ct) => Ok(await svc.AddInvestmentAsync(id, r, ct));
    [HttpDelete("{id}/investments/{invId}"), HasPermission(Perm.SelfService)] public async Task<ActionResult<DeclarationDto>> RemoveInvestment(string id, string invId, CancellationToken ct) => Ok(await svc.RemoveInvestmentAsync(id, invId, ct));
    [HttpPost("{id}/submit"), HasPermission(Perm.SelfService)] public async Task<ActionResult<DeclarationDto>> Submit(string id, CancellationToken ct) => Ok(await svc.SubmitAsync(id, ct));
    [HttpPost("{id}/proofs"), HasPermission(Perm.SelfService)] public async Task<ActionResult<DeclarationDto>> Proof(string id, ProofRequest r, CancellationToken ct) => Ok(await svc.SubmitProofAsync(id, r, ct));
    [HttpPost("{id}/approve"), HasPermission(Perm.TaxReview)] public async Task<ActionResult<DeclarationDto>> Approve(string id, DecisionRequest r, CancellationToken ct) => Ok(await svc.ApproveAsync(id, r.Comment, ct));
    [HttpPost("{id}/reject"), HasPermission(Perm.TaxReview)] public async Task<ActionResult<DeclarationDto>> Reject(string id, RejectRequest r, CancellationToken ct) => Ok(await svc.RejectAsync(id, r.Comment, ct));
}

[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/tax")]
[Authorize]
public sealed class TaxController(IComputationService svc, IDeclarationService declarations, ICurrentUser user) : HrControllerBase
{
    [HttpPost("proofs/{proofId}/verify"), HasPermission(Perm.TaxReview)] public async Task<ActionResult<DeclarationDto>> Verify(string proofId, VerifyProofRequest r, CancellationToken ct) => Ok(await declarations.VerifyProofAsync(proofId, r, ct));
    [HttpPost("proofs/{proofId}/reject"), HasPermission(Perm.TaxReview)] public async Task<ActionResult<DeclarationDto>> RejectProof(string proofId, RejectRequest r, CancellationToken ct) => Ok(await declarations.RejectProofAsync(proofId, r.Comment, ct));

    [HttpGet("rules"), HasPermission(Perm.TaxReview)] public async Task<ActionResult<List<TaxRuleDto>>> Rules([FromQuery] string? financialYear, CancellationToken ct) => Ok(await svc.ListRulesAsync(financialYear, ct));
    [HttpPut("rules"), HasPermission(Perm.TaxConfig)] public async Task<ActionResult<List<TaxRuleDto>>> UpsertRule(TaxRuleRequest r, CancellationToken ct) => Ok(await svc.UpsertRuleAsync(r, ct));

    [HttpGet("compute/me")] public async Task<ActionResult<TaxComputationDto>> ComputeMine([FromQuery] ComputeQuery q, CancellationToken ct) =>
        Ok(await svc.ComputeAsync(user.EmployeeId ?? throw new ForbiddenException("Your account is not linked to an employee"), q.FinancialYear, q.GrossIncome, q.Regime, true, ct));
    [HttpGet("compute/{employeeId}")] public async Task<ActionResult<TaxComputationDto>> Compute(string employeeId, [FromQuery] ComputeQuery q, CancellationToken ct) => Ok(await svc.ComputeAsync(employeeId, q.FinancialYear, q.GrossIncome, q.Regime, true, ct));

    [HttpGet("tds/{employeeId}/{month}"), HasPermission(Perm.TaxReview, Perm.PayrollProcess)]
    public async Task<ActionResult<MonthlyTdsDto>> Tds([FromRoute] TdsMonthParams p, CancellationToken ct)
    {
        if (!System.Text.RegularExpressions.Regex.IsMatch(p.Month, @"^\d{4}-(0[1-9]|1[0-2])$")) throw new Common.Common.ValidationException("month must be yyyy-MM");
        return Ok(await svc.MonthlyTdsAsync(p.EmployeeId, p.Month, ct));
    }

    [HttpGet("summary/{employeeId}/{fy}")] public async Task<ActionResult<AnnualSummaryDto>> Summary(string employeeId, string fy, CancellationToken ct) => Ok(await svc.AnnualSummaryAsync(employeeId, fy, ct));
    [HttpGet("statement/{employeeId}/{fy}")] public async Task<IActionResult> Statement(string employeeId, string fy, CancellationToken ct) => File(await svc.StatementPdfAsync(employeeId, fy, ct), "application/pdf", $"tax-statement-{fy}.pdf");

    [HttpPost("documents"), HasPermission(Perm.TaxReview)] public async Task<IActionResult> RegisterDocument(TaxDocumentRequest r, CancellationToken ct) => StatusCode(201, await svc.RegisterDocumentAsync(r, ct));
    [HttpGet("documents/{employeeId}")] public async Task<ActionResult<List<TaxDocumentDto>>> Documents(string employeeId, [FromQuery] string? fy, CancellationToken ct) => Ok(await svc.ListDocumentsAsync(employeeId, fy, ct));
}
