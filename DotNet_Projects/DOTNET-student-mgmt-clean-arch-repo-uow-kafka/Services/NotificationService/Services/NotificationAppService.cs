using AutoMapper;
using StudentMgmt.BuildingBlocks.Common.Exceptions;
using StudentMgmt.BuildingBlocks.Contracts.Common;
using StudentMgmt.BuildingBlocks.Contracts.Events;
using StudentMgmt.NotificationService.DTOs.Responses;
using StudentMgmt.NotificationService.Entities;
using StudentMgmt.NotificationService.Kafka.Producers;
using StudentMgmt.NotificationService.Services.Interfaces;
using StudentMgmt.NotificationService.Services.Senders;
using StudentMgmt.NotificationService.UnitOfWork;

namespace StudentMgmt.NotificationService.Services;

public class NotificationAppService : INotificationAppService
{
    private readonly INotificationUnitOfWork _unitOfWork;
    private readonly IEmailSender _emailSender;
    private readonly ISmsSender _smsSender;
    private readonly IPushSender _pushSender;
    private readonly NotificationEventPublisher _eventPublisher;
    private readonly IMapper _mapper;

    public NotificationAppService(
        INotificationUnitOfWork unitOfWork,
        IEmailSender emailSender,
        ISmsSender smsSender,
        IPushSender pushSender,
        NotificationEventPublisher eventPublisher,
        IMapper mapper)
    {
        _unitOfWork = unitOfWork;
        _emailSender = emailSender;
        _smsSender = smsSender;
        _pushSender = pushSender;
        _eventPublisher = eventPublisher;
        _mapper = mapper;
    }

    public async Task<NotificationHistory> DeliverAsync(
        NotificationChannel channel,
        string recipientEmail,
        string? recipientPhoneNumber,
        string subject,
        string body,
        string triggeredByEvent,
        Guid? referenceId,
        CancellationToken cancellationToken = default)
    {
        bool success;
        string? failureReason = null;

        try
        {
            success = channel switch
            {
                NotificationChannel.Email => await _emailSender.SendAsync(recipientEmail, subject, body, cancellationToken),
                NotificationChannel.Sms => await _smsSender.SendAsync(recipientPhoneNumber ?? string.Empty, body, cancellationToken),
                NotificationChannel.Push => await _pushSender.SendAsync(recipientEmail, subject, body, cancellationToken),
                _ => throw new BusinessRuleException($"Unsupported notification channel: {channel}.")
            };

            if (!success)
            {
                failureReason = channel switch
                {
                    NotificationChannel.Sms => "Recipient phone number was missing or invalid.",
                    _ => "Delivery failed."
                };
            }
        }
        catch (Exception ex) when (ex is not AppException)
        {
            success = false;
            failureReason = ex.Message;
        }

        var history = new NotificationHistory
        {
            Channel = channel,
            RecipientEmail = recipientEmail,
            RecipientPhoneNumber = recipientPhoneNumber,
            Subject = subject,
            Body = body,
            Success = success,
            FailureReason = failureReason,
            SentOnUtc = DateTime.UtcNow,
            TriggeredByEvent = triggeredByEvent,
            ReferenceId = referenceId
        };

        await _unitOfWork.NotificationHistories.AddAsync(history, cancellationToken);
        await _unitOfWork.CommitAsync(cancellationToken);

        await _eventPublisher.PublishNotificationSentAsync(history, cancellationToken);

        return history;
    }

    public async Task<NotificationHistoryResponse> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var history = await _unitOfWork.NotificationHistories.GetByIdAsync(id, cancellationToken)
            ?? throw new NotFoundException(nameof(NotificationHistory), id);

        return _mapper.Map<NotificationHistoryResponse>(history);
    }

    public async Task<PagedResult<NotificationHistoryResponse>> GetPagedAsync(PagedRequest request, CancellationToken cancellationToken = default)
    {
        System.Linq.Expressions.Expression<Func<NotificationHistory, bool>>? filter = null;
        if (!string.IsNullOrWhiteSpace(request.SearchTerm))
        {
            var term = request.SearchTerm;
            filter = n => n.RecipientEmail.Contains(term) || n.Subject.Contains(term);
        }

        Func<IQueryable<NotificationHistory>, IOrderedQueryable<NotificationHistory>>? orderBy = request.SortBy?.ToLowerInvariant() switch
        {
            "recipientemail" => request.SortDescending
                ? q => q.OrderByDescending(n => n.RecipientEmail)
                : q => q.OrderBy(n => n.RecipientEmail),
            "subject" => request.SortDescending
                ? q => q.OrderByDescending(n => n.Subject)
                : q => q.OrderBy(n => n.Subject),
            "sentonutc" => request.SortDescending
                ? q => q.OrderByDescending(n => n.SentOnUtc)
                : q => q.OrderBy(n => n.SentOnUtc),
            _ => null
        };

        var (items, totalCount) = await _unitOfWork.NotificationHistories.GetPagedAsync(
            request.PageNumber,
            request.PageSize,
            filter,
            orderBy,
            cancellationToken);

        var mapped = items.Select(_mapper.Map<NotificationHistoryResponse>).ToList();

        return PagedResult<NotificationHistoryResponse>.Create(mapped, request.PageNumber, request.PageSize, totalCount);
    }
}
