using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using StudentMgmt.BuildingBlocks.Contracts.Events;
using StudentMgmt.NotificationService.Entities;
using StudentMgmt.NotificationService.Persistence;
using StudentMgmt.NotificationService.Repositories;
using Xunit;

namespace NotificationService.Tests;

public class NotificationHistoryRepositoryTests
{
    private static NotificationDbContext CreateContext(string dbName)
    {
        var options = new DbContextOptionsBuilder<NotificationDbContext>()
            .UseInMemoryDatabase(dbName)
            .Options;

        return new NotificationDbContext(options);
    }

    private static NotificationHistory MakeHistory(string email, DateTime sentOnUtc, string subject = "Subject") => new()
    {
        Channel = NotificationChannel.Email,
        RecipientEmail = email,
        Subject = subject,
        Body = "Body",
        Success = true,
        SentOnUtc = sentOnUtc,
        TriggeredByEvent = "Test"
    };

    [Fact]
    public async Task GetByRecipientAsync_ReturnsOnlyMatchingEmails_OrderedBySentOnUtcDescending()
    {
        await using var context = CreateContext(nameof(GetByRecipientAsync_ReturnsOnlyMatchingEmails_OrderedBySentOnUtcDescending));
        var repository = new NotificationHistoryRepository(context);

        var older = MakeHistory("target@example.com", DateTime.UtcNow.AddDays(-2));
        var newer = MakeHistory("target@example.com", DateTime.UtcNow.AddDays(-1));
        var other = MakeHistory("someone-else@example.com", DateTime.UtcNow);

        context.NotificationHistories.AddRange(older, newer, other);
        await context.SaveChangesAsync();

        var results = await repository.GetByRecipientAsync("target@example.com");

        results.Should().HaveCount(2);
        results.Should().OnlyContain(h => h.RecipientEmail == "target@example.com");
        results[0].Id.Should().Be(newer.Id);
        results[1].Id.Should().Be(older.Id);
    }

    [Fact]
    public async Task GetByRecipientAsync_ExcludesSoftDeletedRows()
    {
        await using var context = CreateContext(nameof(GetByRecipientAsync_ExcludesSoftDeletedRows));
        var repository = new NotificationHistoryRepository(context);

        var deleted = MakeHistory("deleted@example.com", DateTime.UtcNow);
        deleted.IsDeleted = true;

        context.NotificationHistories.Add(deleted);
        await context.SaveChangesAsync();

        var results = await repository.GetByRecipientAsync("deleted@example.com");

        results.Should().BeEmpty();
    }

    [Fact]
    public async Task GetPagedAsync_FiltersAndPaginatesCorrectly()
    {
        await using var context = CreateContext(nameof(GetPagedAsync_FiltersAndPaginatesCorrectly));
        var repository = new NotificationHistoryRepository(context);

        for (var i = 0; i < 5; i++)
        {
            context.NotificationHistories.Add(MakeHistory($"user{i}@example.com", DateTime.UtcNow.AddMinutes(-i), "Welcome"));
        }
        context.NotificationHistories.Add(MakeHistory("noise@example.com", DateTime.UtcNow, "Unrelated"));
        await context.SaveChangesAsync();

        var (items, totalCount) = await repository.GetPagedAsync(
            pageNumber: 1,
            pageSize: 2,
            filter: h => h.Subject == "Welcome");

        totalCount.Should().Be(5);
        items.Should().HaveCount(2);

        var (secondPageItems, secondPageTotal) = await repository.GetPagedAsync(
            pageNumber: 2,
            pageSize: 2,
            filter: h => h.Subject == "Welcome");

        secondPageTotal.Should().Be(5);
        secondPageItems.Should().HaveCount(2);
        items.Select(i => i.Id).Should().NotIntersectWith(secondPageItems.Select(i => i.Id));
    }
}
