using System.Reflection;
using FluentAssertions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Moq;
using StudentMgmt.BuildingBlocks.Common.Constants;
using StudentMgmt.BuildingBlocks.Contracts.Common;
using StudentMgmt.BuildingBlocks.Contracts.Events;
using StudentMgmt.NotificationService.Controllers;
using StudentMgmt.NotificationService.DTOs.Requests;
using StudentMgmt.NotificationService.DTOs.Responses;
using StudentMgmt.NotificationService.Entities;
using StudentMgmt.NotificationService.Services.Interfaces;
using Xunit;

namespace NotificationService.Tests;

public class NotificationsControllerTests
{
    private readonly Mock<INotificationAppService> _appServiceMock = new();
    private readonly NotificationsController _sut;

    public NotificationsControllerTests()
    {
        _sut = new NotificationsController(_appServiceMock.Object);
    }

    [Fact]
    public async Task GetById_ReturnsApiResponse_WithData()
    {
        var id = Guid.NewGuid();
        var expected = new NotificationHistoryResponse
        {
            Id = id,
            Channel = NotificationChannel.Email,
            RecipientEmail = "a@example.com",
            Subject = "Subj",
            Body = "Body",
            Success = true,
            SentOnUtc = DateTime.UtcNow,
            TriggeredByEvent = "Test"
        };

        _appServiceMock.Setup(s => s.GetByIdAsync(id, It.IsAny<CancellationToken>())).ReturnsAsync(expected);

        var actionResult = await _sut.GetById(id, CancellationToken.None);

        var okResult = actionResult.Result.Should().BeOfType<OkObjectResult>().Subject;
        var body = okResult.Value.Should().BeOfType<ApiResponse<NotificationHistoryResponse>>().Subject;

        body.Success.Should().BeTrue();
        body.Data.Should().BeEquivalentTo(expected);
    }

    [Fact]
    public async Task GetPaged_ReturnsApiResponse_WithPagedResult()
    {
        var pagedResult = PagedResult<NotificationHistoryResponse>.Create(
            new List<NotificationHistoryResponse>
            {
                new()
                {
                    Id = Guid.NewGuid(),
                    Channel = NotificationChannel.Email,
                    RecipientEmail = "a@example.com",
                    Subject = "Subj",
                    Body = "Body",
                    Success = true,
                    SentOnUtc = DateTime.UtcNow,
                    TriggeredByEvent = "Test"
                }
            },
            pageNumber: 1,
            pageSize: 10,
            totalCount: 1);

        _appServiceMock
            .Setup(s => s.GetPagedAsync(It.IsAny<PagedRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(pagedResult);

        var actionResult = await _sut.GetPaged(new PagedRequest(), CancellationToken.None);

        var okResult = actionResult.Result.Should().BeOfType<OkObjectResult>().Subject;
        var body = okResult.Value.Should().BeOfType<ApiResponse<PagedResult<NotificationHistoryResponse>>>().Subject;

        body.Success.Should().BeTrue();
        body.Data!.TotalCount.Should().Be(1);
        body.Data.Items.Should().HaveCount(1);
    }

    [Fact]
    public async Task TestSend_CallsDeliverAsync_WithManualTestSendTrigger_AndReturnsApiResponse()
    {
        var request = new SendTestNotificationRequest
        {
            Channel = NotificationChannel.Email,
            RecipientEmail = "a@example.com",
            Subject = "Subj",
            Body = "Body"
        };

        var history = new NotificationHistory
        {
            Channel = NotificationChannel.Email,
            RecipientEmail = "a@example.com",
            Subject = "Subj",
            Body = "Body",
            Success = true,
            SentOnUtc = DateTime.UtcNow,
            TriggeredByEvent = "ManualTestSend"
        };

        _appServiceMock
            .Setup(s => s.DeliverAsync(
                NotificationChannel.Email,
                "a@example.com",
                null,
                "Subj",
                "Body",
                "ManualTestSend",
                null,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(history);

        var actionResult = await _sut.TestSend(request, CancellationToken.None);

        var okResult = actionResult.Result.Should().BeOfType<OkObjectResult>().Subject;
        var body = okResult.Value.Should().BeOfType<ApiResponse<NotificationHistoryResponse>>().Subject;

        body.Success.Should().BeTrue();
        body.Data!.TriggeredByEvent.Should().Be("ManualTestSend");

        _appServiceMock.Verify(s => s.DeliverAsync(
            NotificationChannel.Email,
            "a@example.com",
            null,
            "Subj",
            "Body",
            "ManualTestSend",
            null,
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public void TestSend_Action_RequiresAdminOnlyPolicy()
    {
        var method = typeof(NotificationsController).GetMethod(nameof(NotificationsController.TestSend))!;

        var authorizeAttribute = method.GetCustomAttribute<AuthorizeAttribute>();

        authorizeAttribute.Should().NotBeNull();
        authorizeAttribute!.Policy.Should().Be(PolicyConstants.AdminOnly);
    }

    [Fact]
    public void Controller_Class_HasAuthorizeAttribute()
    {
        var classAuthorize = typeof(NotificationsController).GetCustomAttribute<AuthorizeAttribute>();
        classAuthorize.Should().NotBeNull();
    }
}
