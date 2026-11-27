using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudentMgmt.BuildingBlocks.Common.Constants;
using StudentMgmt.BuildingBlocks.Contracts.Common;
using StudentMgmt.StudentService.DTOs.Requests;
using StudentMgmt.StudentService.DTOs.Responses;
using StudentMgmt.StudentService.Services.Interfaces;

namespace StudentMgmt.StudentService.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/students")]
[Authorize]
public class StudentsController : ControllerBase
{
    private readonly IStudentAppService _studentAppService;

    public StudentsController(IStudentAppService studentAppService)
    {
        _studentAppService = studentAppService;
    }

    [HttpPost]
    [Authorize(Policy = PolicyConstants.CanManageStudents)]
    public async Task<ActionResult<ApiResponse<StudentResponse>>> Create([FromBody] CreateStudentRequest request, CancellationToken cancellationToken)
    {
        var result = await _studentAppService.CreateAsync(request, cancellationToken);
        return Created($"/api/v1/students/{result.Id}", ApiResponse<StudentResponse>.Ok(result, "Student created successfully."));
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = PolicyConstants.CanManageStudents)]
    public async Task<ActionResult<ApiResponse<StudentResponse>>> Update(Guid id, [FromBody] UpdateStudentRequest request, CancellationToken cancellationToken)
    {
        var result = await _studentAppService.UpdateAsync(id, request, cancellationToken);
        return Ok(ApiResponse<StudentResponse>.Ok(result, "Student updated successfully."));
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = PolicyConstants.CanManageStudents)]
    public async Task<ActionResult<ApiResponse<object>>> Delete(Guid id, CancellationToken cancellationToken)
    {
        await _studentAppService.DeleteAsync(id, cancellationToken);
        return Ok(ApiResponse<object>.Ok(new { }, "Student deleted successfully."));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<StudentResponse>>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var result = await _studentAppService.GetByIdAsync(id, cancellationToken);
        return Ok(ApiResponse<StudentResponse>.Ok(result));
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<PagedResult<StudentResponse>>>> GetPaged([FromQuery] PagedRequest request, CancellationToken cancellationToken)
    {
        var result = await _studentAppService.GetPagedAsync(request, cancellationToken);
        return Ok(ApiResponse<PagedResult<StudentResponse>>.Ok(result));
    }

    [HttpGet("{id:guid}/profile")]
    public async Task<ActionResult<ApiResponse<StudentResponse>>> GetProfile(Guid id, CancellationToken cancellationToken)
    {
        var result = await _studentAppService.GetProfileAsync(id, cancellationToken);
        return Ok(ApiResponse<StudentResponse>.Ok(result));
    }
}
