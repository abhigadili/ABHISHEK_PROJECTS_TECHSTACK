using Common.Errors;
using Common.Paging;
using Common.Security;
using Common.Web;
using EnrollmentService.Commands;
using EnrollmentService.Dtos;
using EnrollmentService.Entities;
using EnrollmentService.Queries;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EnrollmentService.Controllers;

/// <summary>Enrollment commands (saga-driven) and queries (CQRS).</summary>
[ApiController, Route("api/enrollments"), Authorize, Tags("Enrollments")]
public class EnrollmentsController(CreateEnrollmentCommandHandler create, CancelEnrollmentCommandHandler cancel, UpdateEnrollmentCommandHandler update, EnrollmentQueryHandlers queries) : ControllerBase
{
    // ------------------------------------------------------------------ commands
    /// <summary>Enroll a student in a course (runs the enrollment saga).</summary>
    /// <remarks>
    /// Send an <c>Idempotency-Key</c> header to make retries safe: the same key always returns the same outcome.
    /// 201 = Confirmed, 422 = Rejected (reason in body), 202 = InProgress (saga paused, resumed automatically), 409 = duplicate active enrollment.
    /// Student users may only enroll themselves. Example body: {"studentId":1,"courseId":1}
    /// </remarks>
    [HttpPost, Authorize(Roles = Roles.AllUsers), ProducesResponseType(typeof(EnrollmentOutcome), 201)]
    public async Task<IActionResult> Enroll(EnrollmentRequest request, [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey, CancellationToken ct)
    {
        RequireSelfOrStaff(request.StudentId!.Value);
        var key = string.IsNullOrWhiteSpace(idempotencyKey) ? Guid.NewGuid().ToString() : idempotencyKey.Trim();
        if (key.Length > 64) throw new ArgumentException("Idempotency-Key must be at most 64 characters");
        var outcome = await create.HandleAsync(new CreateEnrollmentCommand(request.StudentId.Value, request.CourseId!.Value, key, CorrelationIdMiddleware.Current(HttpContext)), ct);
        return StatusCode(outcome.Result switch { EnrollmentOutcome.Confirmed => 201, EnrollmentOutcome.Rejected => 422, _ => 202 }, outcome);
    }

    /// <summary>Cancel a Confirmed enrollment (releases the seat, publishes EnrollmentCancelled).</summary>
    [HttpPost("{id:long}/cancel"), Authorize(Roles = Roles.AllUsers)]
    public async Task<EnrollmentResponse> Cancel(long id, [FromBody] CancelRequest? body, CancellationToken ct)
    {
        RequireSelfOrStaff((await queries.HandleAsync(new GetEnrollmentQuery(id), ct)).StudentId);
        return await cancel.HandleAsync(new CancelEnrollmentCommand(id, body?.Reason), ct);
    }

    /// <summary>Update enrollment remarks (status is managed by the saga / cancel) - Admin, Staff.</summary>
    [HttpPut("{id:long}"), Authorize(Roles = Roles.AdminOrStaff)]
    public Task<EnrollmentResponse> Update(long id, EnrollmentUpdateRequest body, CancellationToken ct) => update.HandleAsync(new UpdateEnrollmentCommand(id, body.Remarks), ct);

    // ------------------------------------------------------------------ queries
    /// <summary>Get an enrollment (Student: own only).</summary>
    [HttpGet("{id:long}"), Authorize(Roles = Roles.AllUsers)]
    public async Task<EnrollmentResponse> Get(long id, CancellationToken ct)
    {
        var e = await queries.HandleAsync(new GetEnrollmentQuery(id), ct);
        RequireSelfOrStaff(e.StudentId);
        return e;
    }

    /// <summary>Search enrollments (filters + paging) - Admin, Staff.</summary>
    [HttpGet, Authorize(Roles = Roles.AdminOrStaff)]
    public Task<PagedResult<EnrollmentResponse>> Search([FromQuery] long? studentId, [FromQuery] long? courseId, [FromQuery] EnrollmentStatus? status,
        [FromQuery] DateOnly? from, [FromQuery] DateOnly? to, [FromQuery] int page = 0, [FromQuery] int size = 10, [FromQuery] string? sort = null, CancellationToken ct = default)
        => queries.HandleAsync(new SearchEnrollmentsQuery(studentId, courseId, status, from, to, Page(page, size, sort)), ct);

    /// <summary>Enrollment history of a student (Student: own only).</summary>
    [HttpGet("student/{studentId:long}"), Authorize(Roles = Roles.AllUsers)]
    public Task<PagedResult<EnrollmentResponse>> History(long studentId, [FromQuery] int page = 0, [FromQuery] int size = 10, [FromQuery] string? sort = null, CancellationToken ct = default)
    {
        RequireSelfOrStaff(studentId);
        return queries.HandleAsync(new StudentEnrollmentHistoryQuery(studentId, Page(page, size, sort)), ct);
    }

    /// <summary>Enrollments of a course - Admin, Staff.</summary>
    [HttpGet("course/{courseId:long}"), Authorize(Roles = Roles.AdminOrStaff)]
    public Task<PagedResult<EnrollmentResponse>> ForCourse(long courseId, [FromQuery] EnrollmentStatus? status, [FromQuery] int page = 0, [FromQuery] int size = 10, [FromQuery] string? sort = null, CancellationToken ct = default)
        => queries.HandleAsync(new CourseEnrollmentsQuery(courseId, status, Page(page, size, sort)), ct);

    private static PageRequest Page(int page, int size, string? sort) => PageRequest.Create(page, size, sort, "EnrollmentId,desc", EnrollmentQueryHandlers.Sortable);

    private void RequireSelfOrStaff(long studentId)
    {
        if (User.IsStaffOrAdmin()) return;
        if (User.StudentId() != studentId) throw new ForbiddenException("Students may only access their own enrollments");
    }
}
