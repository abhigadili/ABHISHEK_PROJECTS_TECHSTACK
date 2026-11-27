using StudentMgmt.BuildingBlocks.Contracts.Common;
using StudentMgmt.EnrollmentService.DTOs.Requests;
using StudentMgmt.EnrollmentService.DTOs.Responses;

namespace StudentMgmt.EnrollmentService.Services.Interfaces;

public interface IEnrollmentAppService
{
    Task<EnrollmentResponse> EnrollAsync(EnrollStudentRequest request, CancellationToken cancellationToken = default);

    Task<EnrollmentResponse> CancelAsync(Guid enrollmentId, CancelEnrollmentRequest request, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<EnrollmentResponse>> GetHistoryAsync(Guid studentId, CancellationToken cancellationToken = default);

    Task<EnrollmentResponse> GetStatusAsync(Guid enrollmentId, CancellationToken cancellationToken = default);

    Task<PagedResult<EnrollmentResponse>> GetPagedAsync(PagedRequest request, CancellationToken cancellationToken = default);
}
