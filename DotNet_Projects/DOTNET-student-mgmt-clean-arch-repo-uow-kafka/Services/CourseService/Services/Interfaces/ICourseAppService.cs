using StudentMgmt.BuildingBlocks.Contracts.Common;
using StudentMgmt.CourseService.DTOs.Requests;
using StudentMgmt.CourseService.DTOs.Responses;

namespace StudentMgmt.CourseService.Services.Interfaces;

public interface ICourseAppService
{
    Task<CourseResponse> CreateAsync(CreateCourseRequest request, CancellationToken cancellationToken = default);

    Task<CourseResponse> UpdateAsync(Guid id, UpdateCourseRequest request, CancellationToken cancellationToken = default);

    Task DeleteAsync(Guid id, CancellationToken cancellationToken = default);

    Task<CourseResponse> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task<PagedResult<CourseResponse>> GetPagedAsync(PagedRequest request, CancellationToken cancellationToken = default);
}
