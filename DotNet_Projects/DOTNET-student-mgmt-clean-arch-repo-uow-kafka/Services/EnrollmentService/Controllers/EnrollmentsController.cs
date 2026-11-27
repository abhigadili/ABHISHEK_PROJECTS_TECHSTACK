using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudentMgmt.BuildingBlocks.Common.Constants;
using StudentMgmt.BuildingBlocks.Contracts.Common;
using StudentMgmt.EnrollmentService.DTOs.Requests;
using StudentMgmt.EnrollmentService.DTOs.Responses;
using StudentMgmt.EnrollmentService.Services.Interfaces;

namespace StudentMgmt.EnrollmentService.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/enrollments")]
[Authorize(Policy = PolicyConstants.CanEnroll)]
public class EnrollmentsController : ControllerBase
{
    private readonly IEnrollmentAppService _enrollmentAppService;

    public EnrollmentsController(IEnrollmentAppService enrollmentAppService)
    {
        _enrollmentAppService = enrollmentAppService;
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<EnrollmentResponse>>> Enroll(
        [FromBody] EnrollStudentRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _enrollmentAppService.EnrollAsync(request, cancellationToken);
        return Ok(ApiResponse<EnrollmentResponse>.Ok(result, "Student enrolled successfully."));
    }

    [HttpPost("{id:guid}/cancel")]
    public async Task<ActionResult<ApiResponse<EnrollmentResponse>>> Cancel(
        [FromRoute] Guid id,
        [FromBody] CancelEnrollmentRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _enrollmentAppService.CancelAsync(id, request, cancellationToken);
        return Ok(ApiResponse<EnrollmentResponse>.Ok(result, "Enrollment cancelled successfully."));
    }

    [HttpGet("students/{studentId:guid}/history")]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<EnrollmentResponse>>>> GetHistory(
        [FromRoute] Guid studentId,
        CancellationToken cancellationToken)
    {
        var result = await _enrollmentAppService.GetHistoryAsync(studentId, cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<EnrollmentResponse>>.Ok(result));
    }

    [HttpGet("{id:guid}/status")]
    public async Task<ActionResult<ApiResponse<EnrollmentResponse>>> GetStatus(
        [FromRoute] Guid id,
        CancellationToken cancellationToken)
    {
        var result = await _enrollmentAppService.GetStatusAsync(id, cancellationToken);
        return Ok(ApiResponse<EnrollmentResponse>.Ok(result));
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<PagedResult<EnrollmentResponse>>>> GetPaged(
        [FromQuery] PagedRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _enrollmentAppService.GetPagedAsync(request, cancellationToken);
        return Ok(ApiResponse<PagedResult<EnrollmentResponse>>.Ok(result));
    }
}
