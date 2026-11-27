using Asp.Versioning;
using HR.Common.Common;
using HR.Common.Crud;
using HR.Common.Hosting;
using HR.Common.Security;
using HR.ProjectService.DTOs;
using HR.ProjectService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HR.ProjectService.Controllers;

[ApiVersion("1.0"), Route("api/v{version:apiVersion}/customers")]
public sealed class CustomersController(ICrudService<CustomerRequest, CustomerDto> s, ICurrentUser u, IContactService contacts) : CrudController<CustomerRequest, CustomerDto>(s, u)
{
    protected override string[] WritePermissions => [Perm.ProjectManage];
    protected override string[] ReadPermissions => [Perm.ProjectManage, Perm.ReportView, Perm.PayrollView];

    [HttpGet("{id}/detail"), HasPermission(Perm.ProjectManage, Perm.ReportView, Perm.PayrollView)]
    public async Task<ActionResult<CustomerDetailDto>> Detail(string id, CancellationToken ct) => Ok(await contacts.DetailAsync(id, ct));

    [HttpGet("{id}/contacts"), HasPermission(Perm.ProjectManage, Perm.ReportView)] public async Task<ActionResult<List<ContactDto>>> Contacts(string id, CancellationToken ct) => Ok(await contacts.ListAsync(id, ct));
    [HttpPost("{id}/contacts"), HasPermission(Perm.ProjectManage)] public async Task<IActionResult> AddContact(string id, ContactRequest r, CancellationToken ct) => StatusCode(201, await contacts.AddAsync(id, r, ct));
    [HttpPut("{id}/contacts/{contactId}"), HasPermission(Perm.ProjectManage)] public async Task<ActionResult<ContactDto>> PutContact(string id, string contactId, ContactRequest r, CancellationToken ct) => Ok(await contacts.UpdateAsync(id, contactId, r, ct));
    [HttpDelete("{id}/contacts/{contactId}"), HasPermission(Perm.ProjectManage)] public async Task<IActionResult> DeleteContact(string id, string contactId, CancellationToken ct) { await contacts.DeleteAsync(id, contactId, ct); return NoContent(); }
}

[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/projects")]
[Authorize]
public sealed class ProjectsController(IProjectService projects) : HrControllerBase
{
    [HttpGet] public async Task<ActionResult<PagedResult<ProjectDto>>> List([FromQuery] ProjectListQuery q, CancellationToken ct) => Ok(await projects.ListAsync(q, ct));
    [HttpPost, HasPermission(Perm.ProjectManage)] public async Task<IActionResult> Create(ProjectRequest r, CancellationToken ct) { var p = await projects.CreateAsync(r, ct); return CreatedAtAction(nameof(Get), new { id = p.Id, version = "1" }, p); }
    [HttpGet("employee/{employeeId}")] public async Task<ActionResult<List<EmployeeProjectDto>>> ForEmployee(string employeeId, CancellationToken ct) => Ok(await projects.EmployeeProjectsAsync(employeeId, ct));
    [HttpGet("employee/{employeeId}/allocation-summary")] public async Task<ActionResult<List<Dictionary<string, object?>>>> Summary(string employeeId, [FromQuery] DateOnly? date, CancellationToken ct) => Ok(await projects.AllocationSummaryAsync(employeeId, date, ct));
    [HttpGet("{id}")] public async Task<ActionResult<ProjectDetailDto>> Get(string id, CancellationToken ct) => Ok(await projects.GetAsync(id, ct));
    [HttpPut("{id}"), HasPermission(Perm.ProjectManage)] public async Task<ActionResult<ProjectDto>> Update(string id, ProjectUpdateRequest r, CancellationToken ct) => Ok(await projects.UpdateAsync(id, r, ct));
    [HttpPatch("{id}/status"), HasPermission(Perm.ProjectManage)] public async Task<ActionResult<ProjectDto>> Status(string id, ChangeStatusRequest r, CancellationToken ct) => Ok(await projects.ChangeStatusAsync(id, r.Status, r.Reason, ct));
    [HttpDelete("{id}"), HasPermission(Perm.ProjectManage)] public async Task<IActionResult> Delete(string id, CancellationToken ct) { await projects.DeleteAsync(id, ct); return NoContent(); }
    [HttpGet("{id}/history"), HasPermission(Perm.ProjectManage)] public async Task<ActionResult<List<ProjectHistoryDto>>> History(string id, CancellationToken ct) => Ok(await projects.HistoryAsync(id, ct));
    [HttpGet("{id}/allocation-check")] public async Task<ActionResult<AllocationCheckDto>> Check(string id, [FromQuery] AllocationCheckQuery q, CancellationToken ct) => Ok(await projects.AllocationCheckAsync(id, q.EmployeeId, q.Date!.Value, ct));
    [HttpPost("{id}/allocations"), HasPermission(Perm.ProjectManage)] public async Task<IActionResult> Allocate(string id, AllocationRequest r, CancellationToken ct) => StatusCode(201, await projects.AllocateAsync(id, r, ct));
    [HttpPut("{id}/allocations/{allocId}"), HasPermission(Perm.ProjectManage)] public async Task<ActionResult<AllocationDto>> UpdateAllocation(string id, string allocId, AllocationUpdateRequest r, CancellationToken ct) => Ok(await projects.UpdateAllocationAsync(id, allocId, r, ct));
    [HttpPost("{id}/allocations/{allocId}/end"), HasPermission(Perm.ProjectManage)] public async Task<ActionResult<AllocationDto>> End(string id, string allocId, EndAllocationRequest r, CancellationToken ct) => Ok(await projects.EndAllocationAsync(id, allocId, r.EndDate, ct));
}
