using Asp.Versioning;
using HR.Common.Common;
using HR.Common.Hosting;
using HR.Common.Security;
using HR.DocumentService.DTOs;
using HR.DocumentService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HR.DocumentService.Controllers;

[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/documents")]
[Authorize]
public sealed class DocumentsController(IDocumentService docs) : HrControllerBase
{
    [HttpGet("categories")] public async Task<ActionResult<List<CategoryDto>>> Categories(CancellationToken ct) => Ok(await docs.ListCategoriesAsync(ct));
    [HttpPost("categories"), HasPermission(Perm.DocumentVerify)] public async Task<IActionResult> CreateCategory(CategoryRequest r, CancellationToken ct) => StatusCode(201, await docs.CreateCategoryAsync(r, ct));
    [HttpPut("categories/{id}"), HasPermission(Perm.DocumentVerify)] public async Task<ActionResult<CategoryDto>> UpdateCategory(string id, CategoryUpdateRequest r, CancellationToken ct) => Ok(await docs.UpdateCategoryAsync(id, r, ct));
    [HttpGet("expiring"), HasPermission(Perm.DocumentVerify)] public async Task<ActionResult<List<DocumentDto>>> Expiring([FromQuery] ExpiringQuery q, CancellationToken ct) => Ok(await docs.ExpiringAsync(q.Days, ct));
    [HttpPost("expiring/remind"), HasPermission(Perm.DocumentVerify)] public async Task<IActionResult> Remind(CancellationToken ct) => Ok(new { reminders = await docs.RemindExpiringAsync(ct) });

    [HttpPost, HasPermission(Perm.SelfService), Consumes("multipart/form-data"), RequestSizeLimit(26_214_400)]
    public async Task<IActionResult> Upload([FromForm] UploadRequest r, CancellationToken ct) => StatusCode(201, await docs.UploadAsync(r, ct));

    [HttpGet] public async Task<ActionResult<PagedResult<DocumentDto>>> List([FromQuery] DocumentListQuery q, CancellationToken ct) => Ok(await docs.ListAsync(q, ct));
    [HttpGet("{id}")] public async Task<ActionResult<DocumentDetailDto>> Get(string id, CancellationToken ct) => Ok(await docs.GetAsync(id, ct));

    [HttpGet("{id}/download")]
    public async Task<IActionResult> Download(string id, CancellationToken ct)
    {
        var (stream, name, type) = await docs.DownloadAsync(id, ct);
        return File(stream, type, name);
    }

    [HttpPost("{id}/verify"), HasPermission(Perm.DocumentVerify)] public async Task<ActionResult<DocumentDto>> Verify(string id, DecisionRequest r, CancellationToken ct) => Ok(await docs.DecideAsync(id, "VERIFIED", r.Comment, ct));
    [HttpPost("{id}/approve"), HasPermission(Perm.DocumentVerify)] public async Task<ActionResult<DocumentDto>> Approve(string id, DecisionRequest r, CancellationToken ct) => Ok(await docs.DecideAsync(id, "APPROVED", r.Comment, ct));
    [HttpPost("{id}/reject"), HasPermission(Perm.DocumentVerify)] public async Task<ActionResult<DocumentDto>> Reject(string id, RejectRequest r, CancellationToken ct) => Ok(await docs.DecideAsync(id, "REJECTED", r.Reason, ct));
    [HttpDelete("{id}")] public async Task<IActionResult> Delete(string id, CancellationToken ct) { await docs.DeleteAsync(id, ct); return NoContent(); }

    [HttpGet("{id}/permissions")] public async Task<ActionResult<List<GrantDto>>> Grants(string id, CancellationToken ct) => Ok(await docs.ListGrantsAsync(id, ct));
    [HttpPost("{id}/permissions")] public async Task<IActionResult> Grant(string id, GrantRequest r, CancellationToken ct) => StatusCode(201, await docs.GrantAsync(id, r, ct));
    [HttpDelete("{id}/permissions/{grantId}")] public async Task<IActionResult> Revoke(string id, string grantId, CancellationToken ct) { await docs.RevokeAsync(id, grantId, ct); return NoContent(); }
}
