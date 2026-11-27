using AutoMapper;
using FluentAssertions;
using Moq;
using StudentMgmt.BuildingBlocks.Contracts.Events;
using StudentMgmt.BuildingBlocks.Messaging;
using StudentMgmt.NotificationService.Entities;
using StudentMgmt.NotificationService.Kafka.Producers;
using StudentMgmt.NotificationService.Mappings;
using StudentMgmt.NotificationService.Repositories.Interfaces;
using StudentMgmt.NotificationService.Services;
using StudentMgmt.NotificationService.Services.Senders;
using StudentMgmt.NotificationService.UnitOfWork;
using Xunit;

namespace NotificationService.Tests;

public class NotificationAppServiceTests
{
    private readonly Mock<INotificationUnitOfWork> _unitOfWorkMock = new();
    private readonly Mock<INotificationHistoryRepository> _repositoryMock = new();
    private readonly Mock<IEmailSender> _emailSenderMock = new();
    private readonly Mock<ISmsSender> _smsSenderMock = new();
    private readonly Mock<IPushSender> _pushSenderMock = new();
    private readonly Mock<IEventProducer> _eventProducerMock = new();
    private readonly IMapper _mapper;
    private readonly NotificationAppService _sut;

    public NotificationAppServiceTests()
    {
        _unitOfWorkMock.Setup(u => u.NotificationHistories).Returns(_repositoryMock.Object);

        var mapperConfig = new MapperConfiguration(cfg => cfg.AddProfile<NotificationProfile>());
        _mapper = mapperConfig.CreateMapper();

        var publisher = new NotificationEventPublisher(_eventProducerMock.Object);

        _sut = new NotificationAppService(
            _unitOfWorkMock.Object,
            _emailSenderMock.Object,
            _smsSenderMock.Object,
            _pushSenderMock.Object,
            publisher,
            _mapper);
    }

    [Fact]
    public async Task DeliverAsync_WithEmailChannel_CallsEmailSenderAndSavesSuccessHistory()
    {
        _emailSenderMock
            .Setup(s => s.SendAsync("student@example.com", "Welcome", "Hello", It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var result = await _sut.DeliverAsync(
            NotificationChannel.Email,
            "student@example.com",
            null,
            "Welcome",
            "Hello",
            nameof(StudentCreatedEvent),
            Guid.NewGuid(),
            CancellationToken.None);

        _emailSenderMock.Verify(
            s => s.SendAsync("student@example.com", "Welcome", "Hello", It.IsAny<CancellationToken>()),
            Times.Once);

        result.Success.Should().BeTrue();
        result.FailureReason.Should().BeNull();
        result.Channel.Should().Be(NotificationChannel.Email);

        _repositoryMock.Verify(r => r.AddAsync(It.Is<NotificationHistory>(h => h.Success), It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWorkMock.Verify(u => u.CommitAsync(It.IsAny<CancellationToken>()), Times.Once);

        _eventProducerMock.Verify(
            p => p.PublishAsync(
                StudentMgmt.BuildingBlocks.Contracts.KafkaTopics.NotificationSent,
                It.Is<NotificationSentEvent>(e => e.Success),
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task DeliverAsync_WithSmsChannelAndMissingPhoneNumber_SavesFailureHistory()
    {
        _smsSenderMock
            .Setup(s => s.SendAsync(string.Empty, "Body text", It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var result = await _sut.DeliverAsync(
            NotificationChannel.Sms,
            "student@example.com",
            null,
            "SMS Subject",
            "Body text",
            "ManualTestSend",
            null,
            CancellationToken.None);

        _smsSenderMock.Verify(
            s => s.SendAsync(string.Empty, "Body text", It.IsAny<CancellationToken>()),
            Times.Once);

        result.Success.Should().BeFalse();
        result.FailureReason.Should().NotBeNullOrWhiteSpace();

        _repositoryMock.Verify(r => r.AddAsync(It.Is<NotificationHistory>(h => !h.Success), It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWorkMock.Verify(u => u.CommitAsync(It.IsAny<CancellationToken>()), Times.Once);

        _eventProducerMock.Verify(
            p => p.PublishAsync(
                StudentMgmt.BuildingBlocks.Contracts.KafkaTopics.NotificationSent,
                It.Is<NotificationSentEvent>(e => !e.Success),
                It.IsAny<CancellationToken>()),
            Times.Once);
    }
}
