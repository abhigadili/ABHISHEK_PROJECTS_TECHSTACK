using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudentMgmt.BuildingBlocks.Common.Constants;
using StudentMgmt.BuildingBlocks.Contracts.Common;
using StudentMgmt.CourseService.DTOs.Requests;
using StudentMgmt.CourseService.DTOs.Responses;
using StudentMgmt.CourseService.Services.Interfaces;

namespace StudentMgmt.CourseService.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/courses")]
[Authorize]
public class CoursesController : ControllerBase
{
    private readonly ICourseAppService _courseAppService;

    public CoursesController(ICourseAppService courseAppService)
    {
        _courseAppService = courseAppService;
    }

    [HttpPost]
    [Authorize(Policy = PolicyConstants.CanManageCourses)]
    public async Task<ActionResult<ApiResponse<CourseResponse>>> CreateAsync([FromBody] CreateCourseRequest request, CancellationToken cancellationToken)
    {
        var course = await _courseAppService.CreateAsync(request, cancellationToken);
        var response = ApiResponse<CourseResponse>.Ok(course, "Course created successfully.");
        return Created($"/api/v1/courses/{course.Id}", response);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = PolicyConstants.CanManageCourses)]
    public async Task<ActionResult<ApiResponse<CourseResponse>>> UpdateAsync(Guid id, [FromBody] UpdateCourseRequest request, CancellationToken cancellationToken)
    {
        var course = await _courseAppService.UpdateAsync(id, request, cancellationToken);
        return Ok(ApiResponse<CourseResponse>.Ok(course, "Course updated successfully."));
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = PolicyConstants.CanManageCourses)]
    public async Task<ActionResult<ApiResponse<object>>> DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        await _courseAppService.DeleteAsync(id, cancellationToken);
        return Ok(ApiResponse<object>.Ok(new { }, "Course deleted successfully."));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<CourseResponse>>> GetByIdAsync(Guid id, CancellationToken cancellationToken)
    {
        var course = await _courseAppService.GetByIdAsync(id, cancellationToken);
        return Ok(ApiResponse<CourseResponse>.Ok(course));
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<PagedResult<CourseResponse>>>> GetPagedAsync([FromQuery] PagedRequest request, CancellationToken cancellationToken)
    {
        var result = await _courseAppService.GetPagedAsync(request, cancellationToken);
        return Ok(ApiResponse<PagedResult<CourseResponse>>.Ok(result));
    }
}
