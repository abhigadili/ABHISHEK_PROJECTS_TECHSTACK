using System.Text.Json.Nodes;
using HR.ApiGateway.Dashboard;
using HR.Common.Common;
using HR.Common.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HR.ApiGateway.Controllers;

/// <summary>Gateway-level aggregation endpoints (not proxied): composed from several microservices concurrently.</summary>
[ApiController]
[Route("api/v1/dashboard")]
[Authorize]
public sealed class DashboardController(IDashboardService dashboards) : ControllerBase
{
    [HttpGet("employee")] public async Task<IActionResult> Employee(CancellationToken ct) => Ok(ApiResponse<JsonObject>.Ok(await dashboards.EmployeeAsync(ct)));
    [HttpGet("manager")] public async Task<IActionResult> Manager(CancellationToken ct) => Ok(ApiResponse<JsonObject>.Ok(await dashboards.ManagerAsync(ct)));
}
