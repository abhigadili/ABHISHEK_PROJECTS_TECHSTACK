using Common.Paging;
using Common.Security;
using CourseService.Dtos;
using CourseService.Entities;
using CourseService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseService.Controllers;

[ApiController, Route("api/courses"), Authorize, Tags("Courses")]
public class CoursesController(ICourseAppService courses, ISeatService seats) : ControllerBase
{
    private static readonly HashSet<string> Sortable = new() { "CourseId", "CourseName", "CourseCode", "Fees", "DurationWeeks", "TotalSeats", "AvailableSeats", "Status", "CreatedAt" };

    /// <summary>Create a course (Admin, Staff).</summary>
    /// <remarks>Example: {"courseName":"Java Microservices","courseCode":"JMS-101","description":"Spring Boot + Kafka","durationWeeks":12,"fees":24999.00,"totalSeats":30}</remarks>
    [HttpPost, Authorize(Roles = Roles.AdminOrStaff), ProducesResponseType(typeof(CourseResponse), 201)]
    public async Task<IActionResult> Create(CourseRequest r, CancellationToken ct)
    { var c = await courses.CreateAsync(r, ct); return Created($"/api/courses/{c.CourseId}", c); }

    /// <summary>Search/filter courses (paged, sortable).</summary>
    [HttpGet]
    public Task<PagedResult<CourseResponse>> Search([FromQuery] string? search, [FromQuery] long? categoryId, [FromQuery] CourseStatus? status,
        [FromQuery] decimal? minFees, [FromQuery] decimal? maxFees, [FromQuery] bool availableOnly = false,
        [FromQuery] int page = 0, [FromQuery] int size = 10, [FromQuery] string? sort = null, CancellationToken ct = default)
        => courses.SearchAsync(search, categoryId, status, minFees, maxFees, availableOnly, PageRequest.Create(page, size, sort, "CourseId,asc", Sortable), ct);

    /// <summary>Get a course (Redis-cached, 10 min).</summary>
    [HttpGet("{id:long}")]
    public Task<CourseResponse> Get(long id, CancellationToken ct) => courses.GetAsync(id, ct);

    /// <summary>Seat availability (Redis-cached, 1 min TTL, evicted on every seat change).</summary>
    [HttpGet("{id:long}/availability")]
    public Task<CourseAvailabilityResponse> Availability(long id, CancellationToken ct) => courses.AvailabilityAsync(id, ct);

    /// <summary>Update a course (changing totalSeats keeps already-reserved seats).</summary>
    [HttpPut("{id:long}"), Authorize(Roles = Roles.AdminOrStaff)]
    public Task<CourseResponse> Update(long id, CourseRequest r, CancellationToken ct) => courses.UpdateAsync(id, r, ct);

    /// <summary>Activate / deactivate a course.</summary>
    [HttpPatch("{id:long}/status"), Authorize(Roles = Roles.AdminOrStaff)]
    public Task<CourseResponse> UpdateStatus(long id, StatusRequest r, CancellationToken ct) => courses.UpdateStatusAsync(id, r.Status!.Value, ct);

    /// <summary>Delete a course (Admin).</summary>
    [HttpDelete("{id:long}"), Authorize(Roles = Roles.Admin), ProducesResponseType(204)]
    public async Task<IActionResult> Delete(long id, CancellationToken ct) { await courses.DeleteAsync(id, ct); return NoContent(); }

    /// <summary>Reserve one seat for an enrollment (atomic, idempotent per enrollmentId). Used by Enrollment Service's saga. 409 when no seats are left or the course is inactive.</summary>
    [HttpPost("{id:long}/seats/reserve"), Authorize(Roles = Roles.AdminOrService)]
    public Task<SeatResponse> Reserve(long id, SeatRequest r, CancellationToken ct) => seats.ReserveAsync(id, r.EnrollmentId!.Value, ct);

    /// <summary>Release the seat held by an enrollment (idempotent; compensating action).</summary>
    [HttpPost("{id:long}/seats/release"), Authorize(Roles = Roles.AdminOrService)]
    public Task<SeatResponse> Release(long id, SeatRequest r, CancellationToken ct) => seats.ReleaseAsync(id, r.EnrollmentId!.Value, ct);
}
