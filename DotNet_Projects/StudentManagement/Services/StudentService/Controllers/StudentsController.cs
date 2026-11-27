using Common.Errors;
using Common.Paging;
using Common.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudentService.Dtos;
using StudentService.Entities;
using StudentService.Services;

namespace StudentService.Controllers;

/// <summary>Student registration, profile management, search and eligibility.</summary>
[ApiController, Route("api/students"), Authorize, Tags("Students")]
public class StudentsController(IStudentAppService service) : ControllerBase
{
    private static readonly HashSet<string> Sortable = new() { "StudentId", "FirstName", "LastName", "Email", "Status", "Gender", "EnrollmentDate", "CreatedAt" };

    /// <summary>Register a student (Admin, Staff).</summary>
    /// <remarks>Example: {"firstName":"Asha","lastName":"Rao","email":"asha.rao@example.com","phoneNumber":"+91 9876543210","dateOfBirth":"2002-05-14","gender":"Female","address":"Hyderabad"}</remarks>
    [HttpPost, Authorize(Roles = Roles.AdminOrStaff), ProducesResponseType(typeof(StudentResponse), 201)]
    public async Task<IActionResult> Create(StudentRequest request, CancellationToken ct)
    {
        var s = await service.CreateAsync(request, ct);
        return Created($"/api/students/{s.StudentId}", s);
    }

    /// <summary>Search/filter students (paged, sortable). search matches first name, last name or e-mail. sort e.g. lastName,asc</summary>
    [HttpGet, Authorize(Roles = Roles.AdminOrStaff)]
    public Task<PagedResult<StudentResponse>> Search([FromQuery] string? search, [FromQuery] StudentStatus? status, [FromQuery] Gender? gender,
        [FromQuery] int page = 0, [FromQuery] int size = 10, [FromQuery] string? sort = null, CancellationToken ct = default)
        => service.SearchAsync(search, status, gender, PageRequest.Create(page, size, sort, "StudentId,asc", Sortable), ct);

    /// <summary>Get a student (a Student user may only read their own profile).</summary>
    [HttpGet("{id:long}"), Authorize(Roles = "Admin,Staff,Service,Student")]
    public Task<StudentResponse> Get(long id, CancellationToken ct)
    {
        RequireSelfOrStaff(id);
        return service.GetAsync(id, ct);
    }

    /// <summary>Is the student eligible to enroll (status Active)? Used by Enrollment Service.</summary>
    [HttpGet("{id:long}/eligibility"), Authorize(Roles = Roles.AdminStaffService)]
    public Task<EligibilityResponse> Eligibility(long id, CancellationToken ct) => service.EligibilityAsync(id, ct);

    /// <summary>Update a student profile (Admin, Staff, or the student themself - but only staff may change status).</summary>
    [HttpPut("{id:long}"), Authorize(Roles = "Admin,Staff,Student")]
    public Task<StudentResponse> Update(long id, StudentRequest request, CancellationToken ct)
    {
        RequireSelfOrStaff(id);
        if (!User.IsStaffOrAdmin() && request.Status != null) throw new ForbiddenException("Students cannot change their status");
        return service.UpdateAsync(id, request, ct);
    }

    /// <summary>Activate / deactivate a student.</summary>
    [HttpPatch("{id:long}/status"), Authorize(Roles = Roles.AdminOrStaff)]
    public Task<StudentResponse> UpdateStatus(long id, StatusUpdateRequest request, CancellationToken ct) => service.UpdateStatusAsync(id, request.Status!.Value, ct);

    /// <summary>Delete a student (Admin only). The linked login account is removed by the database cascade.</summary>
    [HttpDelete("{id:long}"), Authorize(Roles = Roles.Admin), ProducesResponseType(204)]
    public async Task<IActionResult> Delete(long id, CancellationToken ct) { await service.DeleteAsync(id, ct); return NoContent(); }

    private void RequireSelfOrStaff(long studentId)
    {
        if (User.IsStaffOrAdmin()) return;
        if (User.StudentId() != studentId) throw new ForbiddenException("Students may only access their own profile");
    }
}
