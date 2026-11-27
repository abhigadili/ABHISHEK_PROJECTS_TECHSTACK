using System.Linq.Expressions;
using AutoMapper;
using FluentValidation;
using Microsoft.Extensions.Logging;
using StudentMgmt.BuildingBlocks.Common.Exceptions;
using StudentMgmt.BuildingBlocks.Contracts.Common;
using StudentMgmt.CourseService.DTOs.Requests;
using StudentMgmt.CourseService.DTOs.Responses;
using StudentMgmt.CourseService.Entities;
using StudentMgmt.CourseService.Kafka.Producers;
using StudentMgmt.CourseService.Services.Interfaces;
using StudentMgmt.CourseService.UnitOfWork;

namespace StudentMgmt.CourseService.Services;

public class CourseAppService : ICourseAppService
{
    private readonly ICourseUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;
    private readonly IValidator<CreateCourseRequest> _createValidator;
    private readonly IValidator<UpdateCourseRequest> _updateValidator;
    private readonly CourseEventPublisher _eventPublisher;
    private readonly ILogger<CourseAppService> _logger;

    public CourseAppService(
        ICourseUnitOfWork unitOfWork,
        IMapper mapper,
        IValidator<CreateCourseRequest> createValidator,
        IValidator<UpdateCourseRequest> updateValidator,
        CourseEventPublisher eventPublisher,
        ILogger<CourseAppService> logger)
    {
        _unitOfWork = unitOfWork;
        _mapper = mapper;
        _createValidator = createValidator;
        _updateValidator = updateValidator;
        _eventPublisher = eventPublisher;
        _logger = logger;
    }

    public async Task<CourseResponse> CreateAsync(CreateCourseRequest request, CancellationToken cancellationToken = default)
    {
        var validationResult = await _createValidator.ValidateAsync(request, cancellationToken);
        if (!validationResult.IsValid)
        {
            throw new ValidationAppException(validationResult.Errors
                .GroupBy(e => e.PropertyName)
                .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray()));
        }

        if (await _unitOfWork.Courses.CourseCodeExistsAsync(request.CourseCode, cancellationToken))
        {
            throw new BusinessRuleException($"A course with code '{request.CourseCode}' already exists.");
        }

        var course = new Course
        {
            CourseCode = request.CourseCode,
            Title = request.Title,
            Description = request.Description,
            Credits = request.Credits,
            Capacity = request.Capacity,
            InstructorName = request.InstructorName,
            IsActive = true
        };

        await _unitOfWork.Courses.AddAsync(course, cancellationToken);
        await _unitOfWork.CommitAsync(cancellationToken);

        await PublishSafelyAsync(
            () => _eventPublisher.PublishCourseCreatedAsync(course.Id, course.CourseCode, course.Title, course.Credits, course.Capacity, cancellationToken),
            "CourseCreatedEvent",
            course.Id);

        return _mapper.Map<CourseResponse>(course);
    }

    public async Task<CourseResponse> UpdateAsync(Guid id, UpdateCourseRequest request, CancellationToken cancellationToken = default)
    {
        var validationResult = await _updateValidator.ValidateAsync(request, cancellationToken);
        if (!validationResult.IsValid)
        {
            throw new ValidationAppException(validationResult.Errors
                .GroupBy(e => e.PropertyName)
                .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray()));
        }

        var course = await _unitOfWork.Courses.GetByIdAsync(id, cancellationToken)
            ?? throw new NotFoundException("Course", id);

        var existing = await _unitOfWork.Courses.GetByCourseCodeAsync(request.CourseCode, cancellationToken);
        if (existing is not null && existing.Id != id)
        {
            throw new BusinessRuleException($"A course with code '{request.CourseCode}' already exists.");
        }

        course.CourseCode = request.CourseCode;
        course.Title = request.Title;
        course.Description = request.Description;
        course.Credits = request.Credits;
        course.Capacity = request.Capacity;
        course.InstructorName = request.InstructorName;

        _unitOfWork.Courses.Update(course);
        await _unitOfWork.CommitAsync(cancellationToken);

        await PublishSafelyAsync(
            () => _eventPublisher.PublishCourseUpdatedAsync(course.Id, course.CourseCode, course.Title, course.Credits, course.Capacity, cancellationToken),
            "CourseUpdatedEvent",
            course.Id);

        return _mapper.Map<CourseResponse>(course);
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var course = await _unitOfWork.Courses.GetByIdAsync(id, cancellationToken)
            ?? throw new NotFoundException("Course", id);

        _unitOfWork.Courses.Remove(course);
        await _unitOfWork.CommitAsync(cancellationToken);

        await PublishSafelyAsync(
            () => _eventPublisher.PublishCourseDeletedAsync(course.Id, course.CourseCode, cancellationToken),
            "CourseDeletedEvent",
            course.Id);
    }

    public async Task<CourseResponse> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var course = await _unitOfWork.Courses.GetByIdAsync(id, cancellationToken)
            ?? throw new NotFoundException("Course", id);

        return _mapper.Map<CourseResponse>(course);
    }

    public async Task<PagedResult<CourseResponse>> GetPagedAsync(PagedRequest request, CancellationToken cancellationToken = default)
    {
        Expression<Func<Course, bool>>? filter = null;
        if (!string.IsNullOrWhiteSpace(request.SearchTerm))
        {
            var term = request.SearchTerm.Trim();
            filter = c => c.Title.Contains(term) || c.CourseCode.Contains(term);
        }

        var orderBy = BuildOrderBy(request.SortBy, request.SortDescending);

        var (items, totalCount) = await _unitOfWork.Courses.GetPagedAsync(
            request.PageNumber,
            request.PageSize,
            filter,
            orderBy,
            cancellationToken);

        var mappedItems = items.Select(c => _mapper.Map<CourseResponse>(c)).ToList();

        return PagedResult<CourseResponse>.Create(mappedItems, request.PageNumber, request.PageSize, totalCount);
    }

    private static Func<IQueryable<Course>, IOrderedQueryable<Course>> BuildOrderBy(string? sortBy, bool sortDescending)
    {
        return sortBy?.Trim().ToLowerInvariant() switch
        {
            "coursecode" => query => sortDescending ? query.OrderByDescending(c => c.CourseCode) : query.OrderBy(c => c.CourseCode),
            "title" => query => sortDescending ? query.OrderByDescending(c => c.Title) : query.OrderBy(c => c.Title),
            "credits" => query => sortDescending ? query.OrderByDescending(c => c.Credits) : query.OrderBy(c => c.Credits),
            "capacity" => query => sortDescending ? query.OrderByDescending(c => c.Capacity) : query.OrderBy(c => c.Capacity),
            "instructorname" => query => sortDescending ? query.OrderByDescending(c => c.InstructorName) : query.OrderBy(c => c.InstructorName),
            "isactive" => query => sortDescending ? query.OrderByDescending(c => c.IsActive) : query.OrderBy(c => c.IsActive),
            _ => query => sortDescending ? query.OrderByDescending(c => c.CreatedDate) : query.OrderBy(c => c.CreatedDate)
        };
    }

    private async Task PublishSafelyAsync(Func<Task> publish, string eventName, Guid courseId)
    {
        try
        {
            await publish();
        }
        catch (Exception ex)
        {
            // The MySQL write already committed and is the source of truth; a Kafka
            // publish failure must never fail the HTTP request or roll back the
            // database change, so it is only logged here.
            _logger.LogError(ex, "Failed to publish {EventName} for course {CourseId}.", eventName, courseId);
        }
    }
}
