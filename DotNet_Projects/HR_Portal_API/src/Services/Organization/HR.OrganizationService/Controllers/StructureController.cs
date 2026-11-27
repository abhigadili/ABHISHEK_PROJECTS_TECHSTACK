using Asp.Versioning;
using HR.Common.Common;
using HR.Common.Hosting;
using HR.Common.Security;
using HR.OrganizationService.DTOs;
using HR.OrganizationService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HR.OrganizationService.Controllers;

[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/organization")]
[Authorize]
public sealed class StructureController(IStructureService structure, ICurrentUser user) : HrControllerBase
{
    [HttpGet("chart")]
    public async Task<ActionResult<List<TreeNode>>> Chart([FromQuery] ChartQuery q, CancellationToken ct) => Ok(await structure.ChartAsync(q, ct));

    [HttpGet("departments/{id}/employees"), HasPermission(Perm.EmployeeRead, Perm.OrgManage, Perm.TeamView)]
    public async Task<ActionResult<DepartmentEmployeesDto>> DepartmentEmployees(string id, [FromQuery] PageQuery q, CancellationToken ct) => Ok(await structure.DepartmentEmployeesAsync(id, q, ct));

    [HttpGet("employees/{id}/details")]
    public async Task<ActionResult<EmployeeDetailsDto>> Details(string id, CancellationToken ct) => Ok(await structure.DetailsAsync(id, ct));

    [HttpGet("employees/{id}/reporting-chain")]
    public async Task<ActionResult<List<ChainEntryDto>>> Chain(string id, CancellationToken ct) => Ok(await structure.ReportingChainAsync(id, ct));

    [HttpGet("employees/{id}/direct-reports")]
    public async Task<ActionResult<List<EmployeeNodeDto>>> DirectReports(string id, CancellationToken ct) { user.EnsureSelfOr(id, Perm.TeamView, Perm.EmployeeRead, Perm.OrgManage); return Ok(await structure.DirectReportsAsync(id, ct)); }

    [HttpGet("employees/{id}/subordinates")]
    public async Task<ActionResult<List<ChainEntryDto>>> Subordinates(string id, CancellationToken ct) { user.EnsureSelfOr(id, Perm.TeamView, Perm.EmployeeRead, Perm.OrgManage); return Ok(await structure.SubordinatesAsync(id, ct)); }

    [HttpGet("employees/{id}/reporting-history"), HasPermission(Perm.EmployeeRead, Perm.OrgManage)]
    public async Task<ActionResult<List<ReportingLineDto>>> History(string id, CancellationToken ct) => Ok(await structure.ReportingHistoryAsync(id, ct));

    [HttpPut("employees/{id}/manager"), HasPermission(Perm.OrgManage)]
    public async Task<ActionResult<ManagerAssignmentDto>> AssignManager(string id, AssignManagerRequest req, CancellationToken ct) => Ok(await structure.AssignManagerAsync(id, req, ct));
}
