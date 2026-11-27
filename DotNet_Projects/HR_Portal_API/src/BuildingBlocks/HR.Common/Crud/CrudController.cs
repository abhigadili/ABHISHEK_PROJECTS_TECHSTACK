using HR.Common.Common;
using HR.Common.Hosting;
using HR.Common.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HR.Common.Crud;

/// <summary>Thin REST adapter over ICrudService: GET list/one for any authenticated caller, writes need one of WritePermissions.</summary>
[Authorize]
public abstract class CrudController<TReq, TDto>(ICrudService<TReq, TDto> service, ICurrentUser user) : HrControllerBase
{
    protected abstract string[] WritePermissions { get; }
    protected virtual string[] ReadPermissions => [];

    private void RequireWrite() { if (!(user.IsSuperAdmin || user.HasAnyPermission(WritePermissions))) throw new ForbiddenException(); }
    private void RequireRead() { if (ReadPermissions.Length > 0 && !(user.IsSuperAdmin || user.HasAnyPermission(ReadPermissions) || user.HasAnyPermission(WritePermissions))) throw new ForbiddenException(); }

    [HttpGet]
    public virtual async Task<ActionResult<PagedResult<TDto>>> List([FromQuery] PageQuery q, CancellationToken ct) { RequireRead(); return Ok(await service.ListAsync(q, ct)); }

    [HttpGet("{id}")]
    public virtual async Task<ActionResult<TDto>> Get(string id, CancellationToken ct) { RequireRead(); return Ok(await service.GetAsync(id, ct)); }

    [HttpPost]
    public virtual async Task<IActionResult> Create(TReq req, CancellationToken ct)
    {
        RequireWrite();
        var dto = await service.CreateAsync(req, ct);
        return StatusCode(201, dto);
    }

    [HttpPut("{id}")]
    public virtual async Task<ActionResult<TDto>> Update(string id, TReq req, CancellationToken ct) { RequireWrite(); return Ok(await service.UpdateAsync(id, req, ct)); }

    [HttpDelete("{id}")]
    public virtual async Task<IActionResult> Delete(string id, CancellationToken ct) { RequireWrite(); await service.DeleteAsync(id, ct); return NoContent(); }
}
