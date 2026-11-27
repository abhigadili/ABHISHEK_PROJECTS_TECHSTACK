using System.Text.Json;
using HR.Common.Common;
using HR.Common.Data;
using HR.Common.Messaging;
using HR.Common.Security;
using HR.TaxService.Data;
using HR.TaxService.DTOs;
using HR.TaxService.Entities;
using Microsoft.EntityFrameworkCore;

namespace HR.TaxService.Services;

public interface IDeclarationService
{
    Task<DeclarationDto> CreateAsync(CreateDeclarationRequest r, CancellationToken ct);
    Task<DeclarationDto> GetAsync(string id, CancellationToken ct);
    Task<PagedResult<DeclarationSummaryDto>> ListAsync(DeclarationListQuery q, CancellationToken ct);
    Task<DeclarationDto?> MineAsync(string fy, CancellationToken ct);
    Task<DeclarationDto> SetRegimeAsync(string id, string regime, CancellationToken ct);
    Task<DeclarationDto> AddInvestmentAsync(string id, InvestmentRequest r, CancellationToken ct);
    Task<DeclarationDto> RemoveInvestmentAsync(string id, string invId, CancellationToken ct);
    Task<DeclarationDto> SubmitAsync(string id, CancellationToken ct);
    Task<DeclarationDto> SubmitProofAsync(string id, ProofRequest r, CancellationToken ct);
    Task<DeclarationDto> VerifyProofAsync(string proofId, VerifyProofRequest r, CancellationToken ct);
    Task<DeclarationDto> RejectProofAsync(string proofId, string comment, CancellationToken ct);
    Task<DeclarationDto> ApproveAsync(string id, string? comment, CancellationToken ct);
    Task<DeclarationDto> RejectAsync(string id, string comment, CancellationToken ct);
    Task<ReminderResultDto> SendRemindersAsync(string fy, CancellationToken ct);
}

/// <summary>
/// Tax declaration workflow (State pattern): DRAFT -> SUBMITTED -> UNDER_REVIEW -> APPROVED | REJECTED (REJECTED returns to editing).
/// Every transition writes tax_declaration_history and the audit trail; submission publishes tax.declaration.submitted.
/// </summary>
public sealed class DeclarationService(TaxDbContext db, ICurrentUser user, IEventPublisher events, IAuditWriter audit, IUnitOfWork uow, IConfiguration cfg) : IDeclarationService
{
    private static readonly string[] Editable = ["DRAFT", "REJECTED"];
    private int MaxProofAttempts => cfg.GetValue("Tax:MaxProofAttempts", 3);
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private static DeclarationSummaryDto ToSummary(TaxDeclaration d) => new(d.Id, d.EmployeeId, d.EmployeeName, d.FinancialYear, d.Regime, d.Status, d.TotalDeclared, d.TotalApproved, d.SubmittedAt, d.ReviewComment, d.Version);
    private bool IsReviewer => user.HasAnyPermission(Perm.TaxReview, Perm.TaxConfig) || user.IsSuperAdmin;

    private async Task<TaxDeclaration> LoadAsync(string id, bool write, CancellationToken ct)
    {
        var d = await db.TaxDeclarations.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("Tax declaration not found");
        var own = d.EmployeeId == user.EmployeeId;
        if (!own && !IsReviewer) throw new ForbiddenException("You may only access your own tax declaration");
        if (write && !own) throw new ForbiddenException("Only the employee can edit the declaration");
        return d;
    }

    private void History(TaxDeclaration d, string action, string? comment = null, string? status = null) =>
        db.TaxDeclarationHistories.Add(new TaxDeclarationHistory { DeclarationId = d.Id, Action = action, Comment = comment, Status = status ?? d.Status, TotalDeclared = d.TotalDeclared });

    private async Task RetotalAsync(TaxDeclaration d, CancellationToken ct)
    {
        await db.SaveChangesAsync(ct);   // flush investment changes first
        var rows = await db.InvestmentDeclarations.AsNoTracking().Where(i => i.DeclarationId == d.Id).Select(i => new { i.DeclaredAmount, i.ApprovedAmount }).ToListAsync(ct);
        d.TotalDeclared = rows.Sum(r => r.DeclaredAmount); d.TotalApproved = rows.Sum(r => r.ApprovedAmount);
    }

    public async Task<DeclarationDto> CreateAsync(CreateDeclarationRequest r, CancellationToken ct)
    {
        var me = user.EmployeeId ?? throw new ForbiddenException("Your account is not linked to an employee");
        if (await db.TaxDeclarations.AnyAsync(d => d.EmployeeId == me && d.FinancialYear == r.FinancialYear, ct)) throw new ConflictException("A declaration already exists for this financial year");
        if (!await db.TaxRules.AnyAsync(x => x.FinancialYear == r.FinancialYear && x.Regime == r.Regime && x.Active, ct)) throw new BusinessRuleException($"No active {r.Regime} tax rules configured for {r.FinancialYear}");
        var emp = await db.TaxEmployees.AsNoTracking().FirstOrDefaultAsync(e => e.EmployeeId == me, ct);
        var d = new TaxDeclaration { EmployeeId = me, EmployeeName = emp?.FullName, FinancialYear = r.FinancialYear, Regime = r.Regime, Status = "DRAFT" };
        await uow.ExecuteAsync(async () => { db.TaxDeclarations.Add(d); await db.SaveChangesAsync(ct); History(d, "CREATED"); await db.SaveChangesAsync(ct); }, ct);
        return await GetAsync(d.Id, ct);
    }

    public async Task<DeclarationDto> GetAsync(string id, CancellationToken ct)
    {
        var d = await LoadAsync(id, false, ct);
        var inv = await db.InvestmentDeclarations.AsNoTracking().Where(i => i.DeclarationId == id).OrderBy(i => i.CreatedAt).Select(i => new InvestmentDto(i.Id, i.Section, i.Description, i.DeclaredAmount, i.ApprovedAmount, i.Status)).ToListAsync(ct);
        var proofs = await db.TaxProofs.AsNoTracking().Where(p => p.DeclarationId == id).OrderBy(p => p.CreatedAt).Select(p => new ProofDto(p.Id, p.InvestmentId, p.DocumentId, p.FileName, p.AttemptNumber, p.Status, p.ReviewerComment, p.ReviewedAt)).ToListAsync(ct);
        var hist = await db.TaxDeclarationHistories.AsNoTracking().Where(h => h.DeclarationId == id).OrderBy(h => h.CreatedAt).Select(h => new DeclarationHistoryDto(h.Id, h.Action, h.Comment, h.Status, h.TotalDeclared, h.CreatedAt)).ToListAsync(ct);
        return new DeclarationDto(ToSummary(d), inv, proofs, hist);
    }

    public async Task<PagedResult<DeclarationSummaryDto>> ListAsync(DeclarationListQuery q, CancellationToken ct)
    {
        var query = db.TaxDeclarations.AsNoTracking().AsQueryable();
        if (!string.IsNullOrEmpty(q.FinancialYear)) query = query.Where(d => d.FinancialYear == q.FinancialYear);
        if (!string.IsNullOrEmpty(q.Status)) query = query.Where(d => d.Status == q.Status);
        if (IsReviewer) { if (!string.IsNullOrEmpty(q.EmployeeId)) query = query.Where(d => d.EmployeeId == q.EmployeeId); }
        else { var me = user.EmployeeId ?? "-"; query = query.Where(d => d.EmployeeId == me); }
        if (!string.IsNullOrWhiteSpace(q.Search)) { var like = $"%{q.Search.Trim().EscapeLike()}%"; query = query.Where(d => EF.Functions.Like(d.EmployeeName!, like)); }
        query = query.OrderByAllowed(q.Sort ?? "CreatedAt", q.Sort is null || q.Descending, ["CreatedAt", "FinancialYear", "Status", "SubmittedAt"], "CreatedAt");
        return await query.ToPagedAsync(q, d => new DeclarationSummaryDto(d.Id, d.EmployeeId, d.EmployeeName, d.FinancialYear, d.Regime, d.Status, d.TotalDeclared, d.TotalApproved, d.SubmittedAt, d.ReviewComment, d.Version), ct);
    }

    public async Task<DeclarationDto?> MineAsync(string fy, CancellationToken ct)
    {
        var me = user.EmployeeId ?? "-";
        var id = await db.TaxDeclarations.AsNoTracking().Where(d => d.EmployeeId == me && d.FinancialYear == fy).Select(d => d.Id).FirstOrDefaultAsync(ct);
        return id is null ? null : await GetAsync(id, ct);
    }

    public async Task<DeclarationDto> SetRegimeAsync(string id, string regime, CancellationToken ct)
    {
        var d = await LoadAsync(id, true, ct);
        if (!Editable.Contains(d.Status)) throw new BusinessRuleException("The regime can only be changed while the declaration is a draft");
        if (!await db.TaxRules.AnyAsync(r => r.FinancialYear == d.FinancialYear && r.Regime == regime && r.Active, ct)) throw new BusinessRuleException($"No active {regime} rules for {d.FinancialYear}");
        var old = d.Regime;
        await uow.ExecuteAsync(async () => { d.Regime = regime; History(d, "REGIME_CHANGED", regime); await db.SaveChangesAsync(ct); await audit.WriteAsync("TaxDeclaration", id, "REGIME_CHANGED", new { regime = old }, new { regime }); }, ct);
        return await GetAsync(id, ct);
    }

    public async Task<DeclarationDto> AddInvestmentAsync(string id, InvestmentRequest r, CancellationToken ct)
    {
        var d = await LoadAsync(id, true, ct);
        if (!Editable.Contains(d.Status)) throw new BusinessRuleException("Investments can only be edited while the declaration is a draft or rejected");
        if (d.Regime == "NEW") throw new BusinessRuleException("Investment declarations apply to the OLD regime; switch regime first");
        var rule = await db.TaxRules.AsNoTracking().FirstOrDefaultAsync(x => x.FinancialYear == d.FinancialYear && x.Regime == d.Regime && x.Active, ct);
        if (rule is not null && !(JsonSerializer.Deserialize<Dictionary<string, decimal>>(rule.SectionLimits, Json) ?? []).ContainsKey(r.Section))
            throw new Common.Common.ValidationException($"Section {r.Section} is not recognised for {d.FinancialYear}");
        await uow.ExecuteAsync(async () =>
        {
            db.InvestmentDeclarations.Add(new InvestmentDeclaration { DeclarationId = id, Section = r.Section, Description = r.Description, DeclaredAmount = r.DeclaredAmount, ApprovedAmount = 0, Status = "DECLARED" });
            await RetotalAsync(d, ct); History(d, "INVESTMENT_ADDED", r.Section); await db.SaveChangesAsync(ct);
        }, ct);
        return await GetAsync(id, ct);
    }

    public async Task<DeclarationDto> RemoveInvestmentAsync(string id, string invId, CancellationToken ct)
    {
        var d = await LoadAsync(id, true, ct);
        if (!Editable.Contains(d.Status)) throw new BusinessRuleException("Investments can only be edited while the declaration is a draft or rejected");
        var inv = await db.InvestmentDeclarations.FirstOrDefaultAsync(i => i.Id == invId && i.DeclarationId == id, ct) ?? throw new NotFoundException("Investment not found");
        await uow.ExecuteAsync(async () => { db.InvestmentDeclarations.Remove(inv); await RetotalAsync(d, ct); History(d, "INVESTMENT_REMOVED"); await db.SaveChangesAsync(ct); }, ct);
        return await GetAsync(id, ct);
    }

    public async Task<DeclarationDto> SubmitAsync(string id, CancellationToken ct)
    {
        var d = await LoadAsync(id, true, ct);
        if (!Editable.Contains(d.Status)) throw new BusinessRuleException($"Declaration is already {d.Status}");
        if (d.Regime == "OLD" && !await db.InvestmentDeclarations.AnyAsync(i => i.DeclarationId == id, ct)) throw new BusinessRuleException("Add at least one investment or choose the NEW regime");
        var from = d.Status;
        await uow.ExecuteAsync(async () =>
        {
            d.Status = "SUBMITTED"; d.SubmittedAt = DateTime.UtcNow;
            History(d, "SUBMITTED", null, "SUBMITTED");
            events.Publish(Topics.TaxDeclarationSubmitted, d.EmployeeId, new TaxDeclarationEvent(id, d.EmployeeId, d.FinancialYear, d.Regime, d.TotalDeclared, "SUBMITTED"));
            await db.SaveChangesAsync(ct);
            await audit.WriteAsync("TaxDeclaration", id, "SUBMITTED", new { status = from }, new { status = "SUBMITTED" });
        }, ct);
        return await GetAsync(id, ct);
    }

    // ------------------------------------------------------------------ proofs
    public async Task<DeclarationDto> SubmitProofAsync(string id, ProofRequest r, CancellationToken ct)
    {
        var d = await LoadAsync(id, true, ct);
        if (d.Status is not ("SUBMITTED" or "UNDER_REVIEW" or "APPROVED" or "REJECTED")) throw new BusinessRuleException("Submit the declaration before uploading proofs");
        var inv = await db.InvestmentDeclarations.FirstOrDefaultAsync(i => i.Id == r.InvestmentId && i.DeclarationId == id, ct) ?? throw new NotFoundException("Investment not found");
        if (inv.Status == "VERIFIED") throw new ConflictException("This investment is already verified");
        var attempts = await db.TaxProofs.CountAsync(p => p.InvestmentId == r.InvestmentId, ct);
        if (attempts >= MaxProofAttempts) throw new BusinessRuleException($"Maximum of {MaxProofAttempts} proof submissions reached");
        await uow.ExecuteAsync(async () =>
        {
            db.TaxProofs.Add(new TaxProof { DeclarationId = id, InvestmentId = r.InvestmentId, DocumentId = r.DocumentId, FileName = r.FileName, AttemptNumber = attempts + 1, Status = "SUBMITTED" });
            inv.Status = "PROOF_SUBMITTED"; d.Status = "UNDER_REVIEW";
            History(d, attempts > 0 ? "PROOF_RESUBMITTED" : "PROOF_SUBMITTED", inv.Section, "UNDER_REVIEW");
            await db.SaveChangesAsync(ct);
        }, ct);
        return await GetAsync(id, ct);
    }

    public async Task<DeclarationDto> VerifyProofAsync(string proofId, VerifyProofRequest r, CancellationToken ct)
    {
        var p = await db.TaxProofs.FirstOrDefaultAsync(x => x.Id == proofId, ct) ?? throw new NotFoundException("Proof not found");
        var inv = await db.InvestmentDeclarations.FirstAsync(i => i.Id == p.InvestmentId, ct);
        var d = await db.TaxDeclarations.FirstAsync(x => x.Id == p.DeclarationId, ct);
        if (d.EmployeeId == user.EmployeeId) throw new ForbiddenException("You cannot review your own proofs");
        if (p.Status != "SUBMITTED") throw new BusinessRuleException($"Proof is already {p.Status}");
        var approved = Math.Min(r.ApprovedAmount ?? inv.DeclaredAmount, inv.DeclaredAmount);
        await uow.ExecuteAsync(async () =>
        {
            p.Status = "VERIFIED"; p.ReviewerId = user.UserId; p.ReviewedAt = DateTime.UtcNow; p.ReviewerComment = r.Comment;
            inv.Status = "VERIFIED"; inv.ApprovedAmount = approved;
            await RetotalAsync(d, ct); History(d, "PROOF_VERIFIED", inv.Section); await db.SaveChangesAsync(ct);
        }, ct);
        return await GetAsync(d.Id, ct);
    }

    public async Task<DeclarationDto> RejectProofAsync(string proofId, string comment, CancellationToken ct)
    {
        var p = await db.TaxProofs.FirstOrDefaultAsync(x => x.Id == proofId, ct) ?? throw new NotFoundException("Proof not found");
        var inv = await db.InvestmentDeclarations.FirstAsync(i => i.Id == p.InvestmentId, ct);
        var d = await db.TaxDeclarations.FirstAsync(x => x.Id == p.DeclarationId, ct);
        if (p.Status != "SUBMITTED") throw new BusinessRuleException($"Proof is already {p.Status}");
        await uow.ExecuteAsync(async () =>
        {
            p.Status = "REJECTED"; p.ReviewerId = user.UserId; p.ReviewedAt = DateTime.UtcNow; p.ReviewerComment = comment;
            inv.Status = "REJECTED"; inv.ApprovedAmount = 0;
            await RetotalAsync(d, ct); History(d, "PROOF_REJECTED", comment);
            events.Publish(Topics.NotificationRequested, d.EmployeeId, new NotificationRequestedEvent(d.EmployeeId, null, "TAX_PROOF_REJECTED", "IN_APP", "Tax proof rejected",
                $"Your proof for section {inv.Section} was rejected: {comment}. You may resubmit.", null, "TaxDeclaration", d.Id, null));
            await db.SaveChangesAsync(ct);
        }, ct);
        return await GetAsync(d.Id, ct);
    }

    public async Task<DeclarationDto> ApproveAsync(string id, string? comment, CancellationToken ct)
    {
        var d = await db.TaxDeclarations.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("Tax declaration not found");
        if (d.Status is not ("SUBMITTED" or "UNDER_REVIEW")) throw new BusinessRuleException($"Declaration is {d.Status}");
        if (d.EmployeeId == user.EmployeeId) throw new ForbiddenException("You cannot approve your own declaration");
        var pending = await db.InvestmentDeclarations.CountAsync(i => i.DeclarationId == id && (i.Status == "DECLARED" || i.Status == "PROOF_SUBMITTED"), ct);
        await uow.ExecuteAsync(async () =>
        {
            // OLD regime: unverified lines count at the declared value until proofs arrive (provisional approval)
            foreach (var i in await db.InvestmentDeclarations.Where(i => i.DeclarationId == id && (i.Status == "DECLARED" || i.Status == "PROOF_SUBMITTED")).ToListAsync(ct)) i.ApprovedAmount = i.DeclaredAmount;
            d.Status = "APPROVED"; d.ReviewerId = user.UserId; d.ReviewedAt = DateTime.UtcNow; d.ReviewComment = comment;
            await RetotalAsync(d, ct); History(d, pending > 0 ? "APPROVED_PROVISIONALLY" : "APPROVED", comment, "APPROVED");
            await db.SaveChangesAsync(ct);
            await audit.WriteAsync("TaxDeclaration", id, "APPROVED", null, new { pendingProofs = pending });
        }, ct);
        return await GetAsync(id, ct);
    }

    public async Task<DeclarationDto> RejectAsync(string id, string comment, CancellationToken ct)
    {
        var d = await db.TaxDeclarations.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("Tax declaration not found");
        if (d.Status is not ("SUBMITTED" or "UNDER_REVIEW")) throw new BusinessRuleException($"Declaration is {d.Status}");
        await uow.ExecuteAsync(async () =>
        {
            d.Status = "REJECTED"; d.ReviewerId = user.UserId; d.ReviewedAt = DateTime.UtcNow; d.ReviewComment = comment;
            History(d, "REJECTED", comment, "REJECTED");
            await db.SaveChangesAsync(ct);
            await audit.WriteAsync("TaxDeclaration", id, "REJECTED", null, new { comment });
        }, ct);
        return await GetAsync(id, ct);
    }

    /// <summary>Reminder run: every active employee without a submitted declaration gets a notification event (deduplicated downstream).</summary>
    public async Task<ReminderResultDto> SendRemindersAsync(string fy, CancellationToken ct)
    {
        var done = (await db.TaxDeclarations.AsNoTracking().Where(d => d.FinancialYear == fy && (d.Status == "SUBMITTED" || d.Status == "UNDER_REVIEW" || d.Status == "APPROVED")).Select(d => d.EmployeeId).ToListAsync(ct)).ToHashSet();
        var todo = await db.TaxEmployees.AsNoTracking().Where(e => e.Status == "ACTIVE").ToListAsync(ct);
        var n = 0;
        await uow.ExecuteAsync(async () =>
        {
            foreach (var e in todo.Where(e => !done.Contains(e.EmployeeId)))
            {
                events.Publish(Topics.NotificationRequested, e.EmployeeId, new NotificationRequestedEvent(e.EmployeeId, null, "TAX_DECLARATION_REMINDER", "IN_APP", $"Tax declaration reminder ({fy})",
                    $"Please submit your tax regime and investment declaration for {fy}.", null, "TaxDeclaration", fy, $"taxrem:{fy}:{e.EmployeeId}"));
                n++;
            }
            await db.SaveChangesAsync(ct);
        }, ct);
        return new ReminderResultDto(n);
    }
}
