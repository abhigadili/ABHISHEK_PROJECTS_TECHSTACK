using HR.Common.Common;
using HR.Common.Data;
using HR.Common.Messaging;
using HR.Common.Security;
using HR.Common.Storage;
using HR.DocumentService.Data;
using HR.DocumentService.DTOs;
using HR.DocumentService.Entities;
using Mapster;
using Microsoft.EntityFrameworkCore;

namespace HR.DocumentService.Services;

public interface IDocumentService
{
    Task<List<CategoryDto>> ListCategoriesAsync(CancellationToken ct);
    Task<CategoryDto> CreateCategoryAsync(CategoryRequest r, CancellationToken ct);
    Task<CategoryDto> UpdateCategoryAsync(string id, CategoryUpdateRequest r, CancellationToken ct);
    Task<DocumentDto> UploadAsync(UploadRequest r, CancellationToken ct);
    Task<PagedResult<DocumentDto>> ListAsync(DocumentListQuery q, CancellationToken ct);
    Task<DocumentDetailDto> GetAsync(string id, CancellationToken ct);
    Task<(Stream Stream, string FileName, string ContentType)> DownloadAsync(string id, CancellationToken ct);
    Task<DocumentDto> DecideAsync(string id, string to, string? reason, CancellationToken ct);
    Task DeleteAsync(string id, CancellationToken ct);
    Task<GrantDto> GrantAsync(string id, GrantRequest r, CancellationToken ct);
    Task<List<GrantDto>> ListGrantsAsync(string id, CancellationToken ct);
    Task RevokeAsync(string id, string grantId, CancellationToken ct);
    Task<List<DocumentDto>> ExpiringAsync(int days, CancellationToken ct);
    Task<int> RemindExpiringAsync(CancellationToken ct);
    Task RegisterSystemDocumentAsync(string ownerEmployeeId, string categoryCode, string title, string fileName, string storagePath, string sha256, long sizeBytes, string source, CancellationToken ct);
}

/// <summary>Document metadata lives in MySQL, bytes in the configurable file storage. Access: owner, category read roles, or explicit (employee/role) grants with an access level and expiry.</summary>
public sealed class DocumentService(DocumentDbContext db, IFileStorage storage, ICurrentUser user, IEventPublisher events, IAuditWriter audit, IUnitOfWork uow, IConfiguration cfg) : IDocumentService
{
    private static DocumentDto ToDto(Document d) => d.Adapt<DocumentDto>();
    private static CategoryDto ToDto(DocumentCategory c) => new(c.Id, c.Code, c.Name, c.Description, c.ReadRoles.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList(),
        c.RequiresVerification, c.SelfUploadAllowed, c.IsSensitive, c.DefaultExpiryMonths, c.Active);
    private bool IsVerifier => user.HasPermission(Perm.DocumentVerify) || user.IsSuperAdmin;
    private long MaxBytes => cfg.GetValue("Documents:MaxUploadMb", 10) * 1024L * 1024L;
    private static readonly HashSet<string> AllowedTypes = ["application/pdf", "image/png", "image/jpeg", "text/plain", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];

    private bool RoleReadable(DocumentCategory cat) => user.IsSuperAdmin || cat.ReadRoles.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Any(user.IsInRole);

    private async Task<bool> CanAccessAsync(Document doc, bool download, CancellationToken ct)
    {
        if (doc.OwnerEmployeeId == user.EmployeeId) return doc.Status != "REJECTED" || !download;
        var cat = await db.DocumentCategories.AsNoTracking().FirstOrDefaultAsync(c => c.Id == doc.CategoryId, ct);
        if (cat is not null && RoleReadable(cat)) return true;
        var now = DateTime.UtcNow;
        var grants = await db.DocumentPermissions.AsNoTracking().Where(g => g.DocumentId == doc.Id && (g.ExpiresAt == null || g.ExpiresAt > now)).ToListAsync(ct);
        return grants.Any(g => ((g.GranteeType == "EMPLOYEE" && g.GranteeId == user.EmployeeId) || (g.GranteeType == "ROLE" && user.IsInRole(g.GranteeId))) && (!download || g.AccessLevel == "DOWNLOAD"));
    }

    private void History(string documentId, string action, string? detail = null) => db.DocumentHistories.Add(new DocumentHistory { DocumentId = documentId, Action = action, Detail = detail });

    // ------------------------------------------------------------------ categories
    public async Task<List<CategoryDto>> ListCategoriesAsync(CancellationToken ct) => (await db.DocumentCategories.AsNoTracking().Where(c => c.Active).OrderBy(c => c.Name).ToListAsync(ct)).Select(ToDto).ToList();

    public async Task<CategoryDto> CreateCategoryAsync(CategoryRequest r, CancellationToken ct)
    {
        if (await db.DocumentCategories.IgnoreQueryFilters().AnyAsync(c => c.Code == r.Code, ct)) throw new BusinessRuleException("Category code already exists");
        var c = new DocumentCategory { Code = r.Code, Name = r.Name, Description = r.Description, ReadRoles = string.Join(',', r.ReadRoles), RequiresVerification = r.RequiresVerification, SelfUploadAllowed = r.SelfUploadAllowed,
            IsSensitive = r.IsSensitive, DefaultExpiryMonths = r.DefaultExpiryMonths, Active = r.Active };
        db.DocumentCategories.Add(c);
        await db.SaveChangesAsync(ct);
        return ToDto(c);
    }

    public async Task<CategoryDto> UpdateCategoryAsync(string id, CategoryUpdateRequest r, CancellationToken ct)
    {
        var c = await db.DocumentCategories.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("Category not found");
        c.Name = r.Name ?? c.Name; c.Description = r.Description ?? c.Description; if (r.ReadRoles is not null) c.ReadRoles = string.Join(',', r.ReadRoles);
        if (r.RequiresVerification is { } a) c.RequiresVerification = a; if (r.SelfUploadAllowed is { } b) c.SelfUploadAllowed = b; if (r.IsSensitive is { } s) c.IsSensitive = s; if (r.Active is { } ac) c.Active = ac;
        c.DefaultExpiryMonths = r.DefaultExpiryMonths ?? c.DefaultExpiryMonths;
        await db.SaveChangesAsync(ct);
        return ToDto(c);
    }

    // ------------------------------------------------------------------ upload / versions
    public async Task<DocumentDto> UploadAsync(UploadRequest r, CancellationToken ct)
    {
        var file = r.File ?? throw new Common.Common.ValidationException("A file is required (multipart field \"file\")");
        if (file.Length == 0) throw new Common.Common.ValidationException("The file is empty");
        if (file.Length > MaxBytes) throw new Common.Common.ValidationException($"The file exceeds the {MaxBytes / 1024 / 1024} MB limit");
        if (!AllowedTypes.Contains(file.ContentType)) throw new Common.Common.ValidationException($"Content type {file.ContentType} is not allowed");
        var cat = await db.DocumentCategories.FirstOrDefaultAsync(c => c.Id == r.CategoryId, ct) ?? throw new NotFoundException("Category not found");
        if (!cat.Active) throw new BusinessRuleException("Category is not active");
        var owner = r.OwnerEmployeeId ?? user.EmployeeId ?? throw new Common.Common.ValidationException("ownerEmployeeId is required");
        if (owner != user.EmployeeId && !IsVerifier) throw new ForbiddenException("You can only upload your own documents");
        if (owner == user.EmployeeId && !IsVerifier && !cat.SelfUploadAllowed) throw new ForbiddenException($"Employees cannot self-upload {cat.Name}; ask HR");
        var expiry = r.ExpiryDate ?? (cat.DefaultExpiryMonths is { } m ? DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(m)) : null);
        if (expiry is { } e && e < DateOnly.FromDateTime(DateTime.UtcNow)) throw new Common.Common.ValidationException("The document has already expired");

        await using var stream = file.OpenReadStream();
        var stored = await storage.SaveAsync($"documents/{owner}", file.FileName, stream, ct);
        try
        {
            Document doc = null!;
            await uow.ExecuteAsync(async () =>
            {
                var prev = await db.Documents.Where(d => d.OwnerEmployeeId == owner && d.CategoryId == cat.Id && d.Title == r.Title && d.CurrentVersion).FirstOrDefaultAsync(ct);
                if (prev is not null) prev.CurrentVersion = false;
                doc = new Document { OwnerEmployeeId = owner, CategoryId = cat.Id, Title = r.Title, FileName = Path.GetFileName(file.FileName)[..Math.Min(190, Path.GetFileName(file.FileName).Length)], ContentType = file.ContentType,
                    SizeBytes = stored.SizeBytes, Sha256 = stored.Sha256, StoragePath = stored.StoragePath, ExpiryDate = expiry, Source = r.Source, Status = cat.RequiresVerification ? "UPLOADED" : "APPROVED", CurrentVersion = true,
                    VersionNumber = (prev?.VersionNumber ?? 0) + 1, PreviousVersionId = prev?.Id, UploadedBy = user.UserId };
                db.Documents.Add(doc);
                await db.SaveChangesAsync(ct);
                History(doc.Id, "UPLOADED", $"v{doc.VersionNumber} {doc.FileName}");
                await db.SaveChangesAsync(ct);
                await audit.WriteAsync("Document", doc.Id, "UPLOADED", null, new { category = cat.Code, owner });
            }, ct);
            return ToDto(doc);
        }
        catch { storage.Delete(stored.StoragePath); throw; }
    }

    /// <summary>Registers a file another service already wrote to the shared storage (payslips, tax statements, exit letters). Idempotent per storage path.</summary>
    public async Task RegisterSystemDocumentAsync(string ownerEmployeeId, string categoryCode, string title, string fileName, string storagePath, string sha256, long sizeBytes, string source, CancellationToken ct)
    {
        var cat = await db.DocumentCategories.FirstOrDefaultAsync(c => c.Code == categoryCode, ct);
        if (cat is null || await db.Documents.AnyAsync(d => d.StoragePath == storagePath, ct)) return;
        var prev = await db.Documents.Where(d => d.OwnerEmployeeId == ownerEmployeeId && d.CategoryId == cat.Id && d.Title == title && d.CurrentVersion).FirstOrDefaultAsync(ct);
        if (prev is not null) prev.CurrentVersion = false;
        var doc = new Document { OwnerEmployeeId = ownerEmployeeId, CategoryId = cat.Id, Title = title, FileName = fileName, ContentType = "application/pdf", SizeBytes = sizeBytes, Sha256 = sha256, StoragePath = storagePath,
            Source = source, Status = "APPROVED", CurrentVersion = true, VersionNumber = (prev?.VersionNumber ?? 0) + 1, PreviousVersionId = prev?.Id, UploadedBy = "system" };
        db.Documents.Add(doc);
        await db.SaveChangesAsync(ct);
        History(doc.Id, "REGISTERED", source);
        await db.SaveChangesAsync(ct);
    }

    // ------------------------------------------------------------------ read / download
    public async Task<PagedResult<DocumentDto>> ListAsync(DocumentListQuery q, CancellationToken ct)
    {
        var query = db.Documents.AsNoTracking().Where(d => d.CurrentVersion);
        if (!string.IsNullOrEmpty(q.CategoryId)) query = query.Where(d => d.CategoryId == q.CategoryId);
        if (!string.IsNullOrEmpty(q.Status)) query = query.Where(d => d.Status == q.Status);
        if (!string.IsNullOrEmpty(q.Source)) query = query.Where(d => d.Source == q.Source);
        if (IsVerifier) { if (!string.IsNullOrEmpty(q.OwnerEmployeeId)) query = query.Where(d => d.OwnerEmployeeId == q.OwnerEmployeeId); }
        else if (!string.IsNullOrEmpty(q.OwnerEmployeeId) && q.OwnerEmployeeId != user.EmployeeId)
        {
            // category-role holders (e.g. payroll for payslips) may list another employee's documents in categories they can read
            var cats = (await db.DocumentCategories.AsNoTracking().ToListAsync(ct)).Where(RoleReadable).Select(c => c.Id).ToList();
            if (cats.Count == 0) throw new ForbiddenException("You may only list your own documents");
            query = query.Where(d => d.OwnerEmployeeId == q.OwnerEmployeeId && cats.Contains(d.CategoryId));
        }
        else { var me = user.EmployeeId ?? "-"; query = query.Where(d => d.OwnerEmployeeId == me); }
        if (!string.IsNullOrWhiteSpace(q.Search)) { var like = $"%{q.Search.Trim().EscapeLike()}%"; query = query.Where(d => EF.Functions.Like(d.Title, like) || EF.Functions.Like(d.FileName, like)); }
        query = query.OrderByAllowed(q.Sort ?? "CreatedAt", q.Sort is null || q.Descending, ["CreatedAt", "Title", "Status", "ExpiryDate"], "CreatedAt");
        return await query.ToPagedAsync(q, d => new DocumentDto(d.Id, d.Title, d.OwnerEmployeeId, d.CategoryId, d.FileName, d.ContentType, d.SizeBytes, d.Sha256, d.Status, d.Source, d.ExpiryDate, d.VersionNumber, d.CurrentVersion,
            d.PreviousVersionId, d.RejectionReason, d.DecidedAt, d.DecidedBy, d.UploadedBy, d.CreatedAt, d.UpdatedAt), ct);
    }

    public async Task<DocumentDetailDto> GetAsync(string id, CancellationToken ct)
    {
        var d = await db.Documents.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("Document not found");
        if (!await CanAccessAsync(d, false, ct)) throw new ForbiddenException("You are not allowed to view this document");
        var versions = await db.Documents.AsNoTracking().Where(v => v.OwnerEmployeeId == d.OwnerEmployeeId && v.CategoryId == d.CategoryId && v.Title == d.Title).OrderByDescending(v => v.VersionNumber)
            .Select(v => new VersionDto(v.Id, v.VersionNumber, v.CurrentVersion, v.Status, v.CreatedAt, v.FileName)).ToListAsync(ct);
        var history = await db.DocumentHistories.AsNoTracking().Where(h => h.DocumentId == id).OrderBy(h => h.CreatedAt).Select(h => new HistoryDto(h.Id, h.Action, h.Detail, h.CreatedAt)).ToListAsync(ct);
        return new DocumentDetailDto(ToDto(d), versions, history);
    }

    public async Task<(Stream Stream, string FileName, string ContentType)> DownloadAsync(string id, CancellationToken ct)
    {
        var d = await db.Documents.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("Document not found");
        if (!await CanAccessAsync(d, true, ct)) throw new ForbiddenException("You are not allowed to download this document");
        db.DocumentHistories.Add(new DocumentHistory { DocumentId = id, Action = "DOWNLOADED", Detail = user.Username });
        await db.SaveChangesAsync(ct);
        await audit.WriteAsync("Document", id, "DOWNLOADED");
        return (storage.Open(d.StoragePath), d.FileName, d.ContentType);
    }

    // ------------------------------------------------------------------ verification workflow: UPLOADED -> VERIFIED -> APPROVED | REJECTED
    public async Task<DocumentDto> DecideAsync(string id, string to, string? reason, CancellationToken ct)
    {
        var d = await db.Documents.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("Document not found");
        if (d.OwnerEmployeeId == user.EmployeeId) throw new ForbiddenException("You cannot verify your own document");
        var allowed = to switch { "VERIFIED" => new[] { "UPLOADED" }, _ => new[] { "UPLOADED", "VERIFIED" } };
        if (!allowed.Contains(d.Status)) throw new BusinessRuleException($"A {d.Status} document cannot be moved to {to}");
        var from = d.Status;
        await uow.ExecuteAsync(async () =>
        {
            d.Status = to; d.DecidedBy = user.UserId; d.DecidedAt = DateTime.UtcNow; d.RejectionReason = to == "REJECTED" ? reason : null;
            History(id, to, reason);
            if (to == "REJECTED") events.Publish(Topics.NotificationRequested, d.OwnerEmployeeId, new NotificationRequestedEvent(d.OwnerEmployeeId, null, "DOCUMENT_REJECTED", "IN_APP", $"Document rejected: {d.Title}", $"Reason: {reason}", null, "Document", id, null));
            await db.SaveChangesAsync(ct);
            await audit.WriteAsync("Document", id, to, new { status = from }, new { status = to, reason });
        }, ct);
        return ToDto(d);
    }

    public async Task DeleteAsync(string id, CancellationToken ct)
    {
        var d = await db.Documents.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("Document not found");
        if (d.OwnerEmployeeId != user.EmployeeId && !IsVerifier) throw new ForbiddenException();
        if (d.Source is "PAYSLIP" or "EXIT") throw new BusinessRuleException("System generated documents cannot be deleted");
        if (d.OwnerEmployeeId == user.EmployeeId && d.Status != "UPLOADED" && !IsVerifier) throw new BusinessRuleException("Only unverified documents can be deleted by the owner");
        d.Deleted = true; d.DeletedAt = DateTime.UtcNow;
        History(id, "DELETED");
        await db.SaveChangesAsync(ct);
        await audit.WriteAsync("Document", id, "DELETED");
    }

    // ------------------------------------------------------------------ permissions
    private async Task<Document> OwnedOrVerifierAsync(string id, CancellationToken ct)
    {
        var d = await db.Documents.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("Document not found");
        if (d.OwnerEmployeeId != user.EmployeeId && !IsVerifier) throw new ForbiddenException("Only the owner or HR can manage sharing");
        return d;
    }

    public async Task<GrantDto> GrantAsync(string id, GrantRequest r, CancellationToken ct)
    {
        var d = await OwnedOrVerifierAsync(id, ct);
        var cat = await db.DocumentCategories.AsNoTracking().FirstAsync(c => c.Id == d.CategoryId, ct);
        if (cat.IsSensitive && !IsVerifier) throw new ForbiddenException("Sensitive documents can only be shared by HR");
        var g = new DocumentPermission { DocumentId = id, GranteeType = r.GranteeType, GranteeId = r.GranteeId, AccessLevel = r.AccessLevel, ExpiresAt = r.ExpiresAt?.ToUniversalTime() };
        db.DocumentPermissions.Add(g);
        History(id, "ACCESS_GRANTED", $"{r.GranteeType}:{r.GranteeId}");
        await db.SaveChangesAsync(ct);
        await audit.WriteAsync("Document", id, "ACCESS_GRANTED", null, r);
        return new GrantDto(g.Id, g.DocumentId, g.GranteeType, g.GranteeId, g.AccessLevel, g.ExpiresAt);
    }

    public async Task<List<GrantDto>> ListGrantsAsync(string id, CancellationToken ct)
    {
        await OwnedOrVerifierAsync(id, ct);
        return await db.DocumentPermissions.AsNoTracking().Where(g => g.DocumentId == id).Select(g => new GrantDto(g.Id, g.DocumentId, g.GranteeType, g.GranteeId, g.AccessLevel, g.ExpiresAt)).ToListAsync(ct);
    }

    public async Task RevokeAsync(string id, string grantId, CancellationToken ct)
    {
        await OwnedOrVerifierAsync(id, ct);
        var g = await db.DocumentPermissions.FirstOrDefaultAsync(x => x.Id == grantId && x.DocumentId == id, ct) ?? throw new NotFoundException("Grant not found");
        db.DocumentPermissions.Remove(g);
        History(id, "ACCESS_REVOKED", $"{g.GranteeType}:{g.GranteeId}");
        await db.SaveChangesAsync(ct);
    }

    // ------------------------------------------------------------------ expiry
    public async Task<List<DocumentDto>> ExpiringAsync(int days, CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow); var until = today.AddDays(days);
        return (await db.Documents.AsNoTracking().Where(d => d.CurrentVersion && d.ExpiryDate != null && d.ExpiryDate >= today && d.ExpiryDate <= until).OrderBy(d => d.ExpiryDate).ToListAsync(ct)).Select(ToDto).ToList();
    }

    /// <summary>Publishes expiry notifications (deduplicated per day through the dedup key).</summary>
    public async Task<int> RemindExpiringAsync(CancellationToken ct)
    {
        var list = await ExpiringAsync(cfg.GetValue("Documents:ExpiryWarningDays", 30), ct);
        var day = DateTime.UtcNow.ToString("yyyyMMdd");
        await uow.ExecuteAsync(async () =>
        {
            foreach (var d in list)
                events.Publish(Topics.NotificationRequested, d.OwnerEmployeeId, new NotificationRequestedEvent(d.OwnerEmployeeId, null, "DOCUMENT_EXPIRING", "IN_APP", $"Document expiring: {d.Title}",
                    $"\"{d.Title}\" expires on {d.ExpiryDate:yyyy-MM-dd}. Please upload a renewed copy.", null, "Document", d.Id, $"docexp:{d.Id}:{day}"));
            await db.SaveChangesAsync(ct);
        }, ct);
        return list.Count;
    }
}
