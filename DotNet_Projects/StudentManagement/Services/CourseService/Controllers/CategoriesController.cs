using Common.Security;
using CourseService.Dtos;
using CourseService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseService.Controllers;

[ApiController, Route("api/courses/categories"), Authorize, Tags("Course categories")]
public class CategoriesController(CategoryAppService service) : ControllerBase
{
    /// <summary>Create a category (Admin, Staff).</summary>
    [HttpPost, Authorize(Roles = Roles.AdminOrStaff), ProducesResponseType(typeof(CategoryResponse), 201)]
    public async Task<IActionResult> Create(CategoryRequest r, CancellationToken ct)
    { var c = await service.CreateAsync(r, ct); return Created($"/api/courses/categories/{c.CategoryId}", c); }

    /// <summary>List categories.</summary>
    [HttpGet]
    public Task<List<CategoryResponse>> List(CancellationToken ct) => service.ListAsync(ct);

    /// <summary>Update a category (Admin, Staff).</summary>
    [HttpPut("{id:long}"), Authorize(Roles = Roles.AdminOrStaff)]
    public Task<CategoryResponse> Update(long id, CategoryRequest r, CancellationToken ct) => service.UpdateAsync(id, r, ct);

    /// <summary>Delete an unused category (Admin).</summary>
    [HttpDelete("{id:long}"), Authorize(Roles = Roles.Admin), ProducesResponseType(204)]
    public async Task<IActionResult> Delete(long id, CancellationToken ct) { await service.DeleteAsync(id, ct); return NoContent(); }
}
