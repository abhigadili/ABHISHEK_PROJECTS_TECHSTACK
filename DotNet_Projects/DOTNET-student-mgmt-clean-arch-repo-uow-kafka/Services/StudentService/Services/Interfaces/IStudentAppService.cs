using StudentMgmt.BuildingBlocks.Contracts.Common;
using StudentMgmt.StudentService.DTOs.Requests;
using StudentMgmt.StudentService.DTOs.Responses;

namespace StudentMgmt.StudentService.Services.Interfaces;

public interface IStudentAppService
{
    Task<StudentResponse> CreateAsync(CreateStudentRequest request, CancellationToken cancellationToken = default);

    Task<StudentResponse> UpdateAsync(Guid id, UpdateStudentRequest request, CancellationToken cancellationToken = default);

    Task DeleteAsync(Guid id, CancellationToken cancellationToken = default);

    Task<StudentResponse> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task<PagedResult<StudentResponse>> GetPagedAsync(PagedRequest request, CancellationToken cancellationToken = default);

    Task<StudentResponse> GetProfileAsync(Guid studentId, CancellationToken cancellationToken = default);
}
