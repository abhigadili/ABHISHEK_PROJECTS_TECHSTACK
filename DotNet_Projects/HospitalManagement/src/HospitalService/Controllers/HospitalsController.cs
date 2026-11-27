using HMS.Hospitals.Dtos;
using HMS.Hospitals.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HMS.Hospitals.Controllers;

[ApiController, Authorize, Route("api")]
public sealed class HospitalsController(IHospitalAppService service) : ControllerBase
{
    [HttpPost("hospitals"), Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> Create([FromBody] HospitalRequest r, CancellationToken ct) => StatusCode(201, await service.CreateAsync(r, ct));

    [HttpGet("hospitals")]
    public Task<List<HospitalResponse>> List(CancellationToken ct) => service.ListAsync(ct);

    [HttpGet("hospitals/{id:long}")]
    public Task<HospitalResponse> Get(long id, CancellationToken ct) => service.GetAsync(id, ct);

    [HttpPut("hospitals/{id:long}"), Authorize(Roles = "ADMIN")]
    public Task<HospitalResponse> Update(long id, [FromBody] HospitalRequest r, CancellationToken ct) => service.UpdateAsync(id, r, ct);

    [HttpDelete("hospitals/{id:long}"), Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> Deactivate(long id, CancellationToken ct) { await service.DeactivateAsync(id, ct); return NoContent(); }

    [HttpGet("hospitals/{id:long}/departments")]
    public Task<List<DepartmentResponse>> Departments(long id, CancellationToken ct) => service.DepartmentsAsync(id, ct);

    [HttpPost("hospitals/{id:long}/departments"), Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> AddDepartment(long id, [FromBody] DepartmentRequest r, CancellationToken ct) => StatusCode(201, await service.AddDepartmentAsync(id, r, ct));

    [HttpGet("departments/{id:long}")]
    public Task<DepartmentResponse> Department(long id, CancellationToken ct) => service.DepartmentAsync(id, ct);

    [HttpPut("departments/{id:long}"), Authorize(Roles = "ADMIN")]
    public Task<DepartmentResponse> UpdateDepartment(long id, [FromBody] DepartmentRequest r, CancellationToken ct) => service.UpdateDepartmentAsync(id, r, ct);

    [HttpDelete("departments/{id:long}"), Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> DeactivateDepartment(long id, CancellationToken ct) { await service.DeactivateDepartmentAsync(id, ct); return NoContent(); }
}
