using AutoMapper;
using FluentValidation;
using Microsoft.Extensions.Logging;
using StudentMgmt.BuildingBlocks.Common.Exceptions;
using StudentMgmt.BuildingBlocks.Contracts.Common;
using StudentMgmt.StudentService.DTOs.Requests;
using StudentMgmt.StudentService.DTOs.Responses;
using StudentMgmt.StudentService.Entities;
using StudentMgmt.StudentService.Kafka.Producers;
using StudentMgmt.StudentService.Services.Interfaces;
using StudentMgmt.StudentService.UnitOfWork;

namespace StudentMgmt.StudentService.Services;

public class StudentAppService : IStudentAppService
{
    private readonly IStudentUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;
    private readonly IValidator<CreateStudentRequest> _createValidator;
    private readonly IValidator<UpdateStudentRequest> _updateValidator;
    private readonly StudentEventPublisher _eventPublisher;
    private readonly ILogger<StudentAppService> _logger;

    public StudentAppService(
        IStudentUnitOfWork unitOfWork,
        IMapper mapper,
        IValidator<CreateStudentRequest> createValidator,
        IValidator<UpdateStudentRequest> updateValidator,
        StudentEventPublisher eventPublisher,
        ILogger<StudentAppService> logger)
    {
        _unitOfWork = unitOfWork;
        _mapper = mapper;
        _createValidator = createValidator;
        _updateValidator = updateValidator;
        _eventPublisher = eventPublisher;
        _logger = logger;
    }

    public async Task<StudentResponse> CreateAsync(CreateStudentRequest request, CancellationToken cancellationToken = default)
    {
        var validationResult = await _createValidator.ValidateAsync(request, cancellationToken);
        if (!validationResult.IsValid)
        {
            throw new ValidationAppException(ToErrorDictionary(validationResult));
        }

        if (await _unitOfWork.Students.EmailExistsAsync(request.Email, cancellationToken))
        {
            throw new BusinessRuleException($"A student with email '{request.Email}' already exists.");
        }

        var student = new Student
        {
            FirstName = request.FirstName,
            LastName = request.LastName,
            Email = request.Email,
            PhoneNumber = request.PhoneNumber,
            DateOfBirth = request.DateOfBirth,
            Address = request.Address,
            EnrollmentNumber = EnrollmentNumberGenerator.Generate()
        };

        await _unitOfWork.Students.AddAsync(student, cancellationToken);
        await _unitOfWork.CommitAsync(cancellationToken);

        PublishFireAndForget(ct => _eventPublisher.PublishStudentCreatedAsync(student, ct), "StudentCreatedEvent", student.Id);

        return _mapper.Map<StudentResponse>(student);
    }

    public async Task<StudentResponse> UpdateAsync(Guid id, UpdateStudentRequest request, CancellationToken cancellationToken = default)
    {
        var validationResult = await _updateValidator.ValidateAsync(request, cancellationToken);
        if (!validationResult.IsValid)
        {
            throw new ValidationAppException(ToErrorDictionary(validationResult));
        }

        var student = await _unitOfWork.Students.GetByIdAsync(id, cancellationToken)
            ?? throw new NotFoundException(nameof(Student), id);

        if (!string.Equals(student.Email, request.Email, StringComparison.OrdinalIgnoreCase) &&
            await _unitOfWork.Students.EmailExistsAsync(request.Email, cancellationToken))
        {
            throw new BusinessRuleException($"A student with email '{request.Email}' already exists.");
        }

        student.FirstName = request.FirstName;
        student.LastName = request.LastName;
        student.Email = request.Email;
        student.PhoneNumber = request.PhoneNumber;
        student.DateOfBirth = request.DateOfBirth;
        student.Address = request.Address;

        _unitOfWork.Students.Update(student);
        await _unitOfWork.CommitAsync(cancellationToken);

        PublishFireAndForget(ct => _eventPublisher.PublishStudentUpdatedAsync(student, ct), "StudentUpdatedEvent", student.Id);

        return _mapper.Map<StudentResponse>(student);
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var student = await _unitOfWork.Students.GetByIdAsync(id, cancellationToken)
            ?? throw new NotFoundException(nameof(Student), id);

        _unitOfWork.Students.Remove(student);
        await _unitOfWork.CommitAsync(cancellationToken);

        PublishFireAndForget(ct => _eventPublisher.PublishStudentDeletedAsync(student, ct), "StudentDeletedEvent", student.Id);
    }

    public async Task<StudentResponse> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var student = await _unitOfWork.Students.GetByIdAsync(id, cancellationToken)
            ?? throw new NotFoundException(nameof(Student), id);

        return _mapper.Map<StudentResponse>(student);
    }

    public async Task<PagedResult<StudentResponse>> GetPagedAsync(PagedRequest request, CancellationToken cancellationToken = default)
    {
        Func<IQueryable<Student>, IOrderedQueryable<Student>> orderBy = request.SortBy?.ToLowerInvariant() switch
        {
            "firstname" => q => request.SortDescending ? q.OrderByDescending(s => s.FirstName) : q.OrderBy(s => s.FirstName),
            "lastname" => q => request.SortDescending ? q.OrderByDescending(s => s.LastName) : q.OrderBy(s => s.LastName),
            "email" => q => request.SortDescending ? q.OrderByDescending(s => s.Email) : q.OrderBy(s => s.Email),
            "enrollmentnumber" => q => request.SortDescending ? q.OrderByDescending(s => s.EnrollmentNumber) : q.OrderBy(s => s.EnrollmentNumber),
            _ => q => request.SortDescending ? q.OrderByDescending(s => s.CreatedDate) : q.OrderBy(s => s.CreatedDate)
        };

        var searchTerm = request.SearchTerm?.Trim();

        var (items, totalCount) = await _unitOfWork.Students.GetPagedAsync(
            request.PageNumber,
            request.PageSize,
            filter: string.IsNullOrWhiteSpace(searchTerm)
                ? null
                : s => s.FirstName.Contains(searchTerm) ||
                       s.LastName.Contains(searchTerm) ||
                       s.Email.Contains(searchTerm) ||
                       s.EnrollmentNumber.Contains(searchTerm),
            orderBy: orderBy,
            cancellationToken: cancellationToken);

        var mappedItems = items.Select(_mapper.Map<StudentResponse>).ToList();

        return PagedResult<StudentResponse>.Create(mappedItems, request.PageNumber, request.PageSize, totalCount);
    }

    public async Task<StudentResponse> GetProfileAsync(Guid studentId, CancellationToken cancellationToken = default)
    {
        var student = await _unitOfWork.Students.GetByIdAsync(studentId, cancellationToken)
            ?? throw new NotFoundException(nameof(Student), studentId);

        return _mapper.Map<StudentResponse>(student);
    }

    /// <summary>
    /// Publishes an integration event on a detached background task instead of
    /// awaiting it inline. The shared Kafka producer's ProduceAsync can block for
    /// several minutes (librdkafka's default message.timeout.ms) when the broker
    /// is unreachable, which would otherwise stall this HTTP response even though
    /// the MySQL write (the source of truth) already committed successfully.
    /// Fire-and-forget + log-on-failure keeps Kafka strictly best-effort. A fresh
    /// CancellationToken.None is used deliberately: the request's own token would
    /// be cancelled as soon as this method returns and the response is sent.
    /// </summary>
    private void PublishFireAndForget(Func<CancellationToken, Task> publish, string eventName, Guid studentId)
    {
        _ = Task.Run(async () =>
        {
            try
            {
                await publish(CancellationToken.None);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to publish {EventName} for student {StudentId}. The database write already committed; this is a best-effort notification only.", eventName, studentId);
            }
        });
    }

    private static IReadOnlyDictionary<string, string[]> ToErrorDictionary(FluentValidation.Results.ValidationResult result) =>
        result.Errors
            .GroupBy(e => e.PropertyName)
            .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray());
}
