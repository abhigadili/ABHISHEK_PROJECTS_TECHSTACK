using AutoMapper;
using StudentMgmt.BuildingBlocks.Contracts.Common;
using StudentMgmt.BuildingBlocks.Contracts.Events;
using StudentMgmt.BuildingBlocks.Common.Exceptions;
using StudentMgmt.EnrollmentService.DTOs.Requests;
using StudentMgmt.EnrollmentService.DTOs.Responses;
using StudentMgmt.EnrollmentService.Entities;
using StudentMgmt.EnrollmentService.Kafka.Producers;
using StudentMgmt.EnrollmentService.Services.Interfaces;
using StudentMgmt.EnrollmentService.UnitOfWork;

namespace StudentMgmt.EnrollmentService.Services;

public class EnrollmentAppService : IEnrollmentAppService
{
    private readonly IEnrollmentUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;
    private readonly EnrollmentEventPublisher _eventPublisher;

    public EnrollmentAppService(IEnrollmentUnitOfWork unitOfWork, IMapper mapper, EnrollmentEventPublisher eventPublisher)
    {
        _unitOfWork = unitOfWork;
        _mapper = mapper;
        _eventPublisher = eventPublisher;
    }

    public async Task<EnrollmentResponse> EnrollAsync(EnrollStudentRequest request, CancellationToken cancellationToken = default)
    {
        var studentSnapshot = await _unitOfWork.StudentSnapshots.GetByIdAsync(request.StudentId, cancellationToken)
            ?? throw new NotFoundException("Student", request.StudentId);

        var courseSnapshot = await _unitOfWork.CourseSnapshots.GetByIdAsync(request.CourseId, cancellationToken)
            ?? throw new NotFoundException("Course", request.CourseId);

        if (courseSnapshot.EnrolledCount >= courseSnapshot.Capacity)
        {
            throw new BusinessRuleException("Course is at full capacity.");
        }

        if (await _unitOfWork.Enrollments.HasActiveEnrollmentAsync(request.StudentId, request.CourseId, cancellationToken))
        {
            throw new BusinessRuleException("Student is already enrolled in this course.");
        }

        var enrollment = new Enrollment
        {
            StudentId = request.StudentId,
            CourseId = request.CourseId,
            Status = EnrollmentStatus.Confirmed,
            EnrolledOnUtc = DateTime.UtcNow
        };

        await _unitOfWork.Enrollments.AddAsync(enrollment, cancellationToken);

        courseSnapshot.EnrolledCount += 1;
        _unitOfWork.CourseSnapshots.Update(courseSnapshot);

        await _unitOfWork.CommitAsync(cancellationToken);

        await _eventPublisher.PublishEnrollmentCreatedAsync(new EnrollmentCreatedEvent
        {
            EnrollmentId = enrollment.Id,
            StudentId = enrollment.StudentId,
            CourseId = enrollment.CourseId,
            StudentEmail = studentSnapshot.Email,
            StudentFullName = studentSnapshot.FullName,
            CourseTitle = courseSnapshot.Title,
            EnrolledOnUtc = enrollment.EnrolledOnUtc
        }, cancellationToken);

        return ToResponse(enrollment, studentSnapshot.FullName, courseSnapshot.Title);
    }

    public async Task<EnrollmentResponse> CancelAsync(Guid enrollmentId, CancelEnrollmentRequest request, CancellationToken cancellationToken = default)
    {
        var enrollment = await _unitOfWork.Enrollments.GetByIdAsync(enrollmentId, cancellationToken);
        if (enrollment is null || enrollment.Status == EnrollmentStatus.Cancelled)
        {
            throw new NotFoundException("Enrollment", enrollmentId);
        }

        var studentSnapshot = await _unitOfWork.StudentSnapshots.GetByIdAsync(enrollment.StudentId, cancellationToken);
        var courseSnapshot = await _unitOfWork.CourseSnapshots.GetByIdAsync(enrollment.CourseId, cancellationToken);

        enrollment.Status = EnrollmentStatus.Cancelled;
        enrollment.CancelledOnUtc = DateTime.UtcNow;
        enrollment.CancellationReason = request.Reason;
        _unitOfWork.Enrollments.Update(enrollment);

        if (courseSnapshot is not null)
        {
            courseSnapshot.EnrolledCount = Math.Max(0, courseSnapshot.EnrolledCount - 1);
            _unitOfWork.CourseSnapshots.Update(courseSnapshot);
        }

        await _unitOfWork.CommitAsync(cancellationToken);

        await _eventPublisher.PublishEnrollmentCancelledAsync(new EnrollmentCancelledEvent
        {
            EnrollmentId = enrollment.Id,
            StudentId = enrollment.StudentId,
            CourseId = enrollment.CourseId,
            StudentEmail = studentSnapshot?.Email ?? string.Empty,
            Reason = request.Reason
        }, cancellationToken);

        return ToResponse(enrollment, studentSnapshot?.FullName ?? string.Empty, courseSnapshot?.Title ?? string.Empty);
    }

    public async Task<IReadOnlyList<EnrollmentResponse>> GetHistoryAsync(Guid studentId, CancellationToken cancellationToken = default)
    {
        var enrollments = await _unitOfWork.Enrollments.GetByStudentIdAsync(studentId, cancellationToken);
        var responses = new List<EnrollmentResponse>(enrollments.Count);

        foreach (var enrollment in enrollments)
        {
            responses.Add(await BuildResponseAsync(enrollment, cancellationToken));
        }

        return responses;
    }

    public async Task<EnrollmentResponse> GetStatusAsync(Guid enrollmentId, CancellationToken cancellationToken = default)
    {
        var enrollment = await _unitOfWork.Enrollments.GetByIdAsync(enrollmentId, cancellationToken)
            ?? throw new NotFoundException("Enrollment", enrollmentId);

        return await BuildResponseAsync(enrollment, cancellationToken);
    }

    public async Task<PagedResult<EnrollmentResponse>> GetPagedAsync(PagedRequest request, CancellationToken cancellationToken = default)
    {
        var (items, totalCount) = await _unitOfWork.Enrollments.GetPagedAsync(
            request.PageNumber,
            request.PageSize,
            cancellationToken: cancellationToken);

        var responses = new List<EnrollmentResponse>(items.Count);
        foreach (var enrollment in items)
        {
            responses.Add(await BuildResponseAsync(enrollment, cancellationToken));
        }

        return PagedResult<EnrollmentResponse>.Create(responses, request.PageNumber, request.PageSize, totalCount);
    }

    private async Task<EnrollmentResponse> BuildResponseAsync(Enrollment enrollment, CancellationToken cancellationToken)
    {
        var studentSnapshot = await _unitOfWork.StudentSnapshots.GetByIdAsync(enrollment.StudentId, cancellationToken);
        var courseSnapshot = await _unitOfWork.CourseSnapshots.GetByIdAsync(enrollment.CourseId, cancellationToken);

        return ToResponse(enrollment, studentSnapshot?.FullName ?? string.Empty, courseSnapshot?.Title ?? string.Empty);
    }

    private EnrollmentResponse ToResponse(Enrollment enrollment, string studentFullName, string courseTitle)
    {
        var response = _mapper.Map<EnrollmentResponse>(enrollment);
        response.StudentFullName = studentFullName;
        response.CourseTitle = courseTitle;
        return response;
    }
}
