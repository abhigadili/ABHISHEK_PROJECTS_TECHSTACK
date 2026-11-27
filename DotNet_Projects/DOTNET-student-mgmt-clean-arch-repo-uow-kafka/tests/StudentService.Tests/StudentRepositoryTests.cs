using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using StudentMgmt.StudentService.Entities;
using StudentMgmt.StudentService.Persistence;
using StudentMgmt.StudentService.Repositories;
using Xunit;

namespace StudentMgmt.StudentService.Tests;

public class StudentRepositoryTests
{
    private static StudentDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<StudentDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new StudentDbContext(options);
    }

    private static async Task<StudentDbContext> SeedAsync(StudentDbContext context)
    {
        var students = new[]
        {
            new Student { FirstName = "Amy", LastName = "Adams", Email = "amy.adams@example.com", EnrollmentNumber = "STU-2026-100001", DateOfBirth = new DateTime(1998, 1, 1) },
            new Student { FirstName = "Ben", LastName = "Baker", Email = "ben.baker@example.com", EnrollmentNumber = "STU-2026-100002", DateOfBirth = new DateTime(1997, 2, 2) },
            new Student { FirstName = "Cara", LastName = "Clark", Email = "cara.clark@example.com", EnrollmentNumber = "STU-2026-100003", DateOfBirth = new DateTime(1996, 3, 3) },
            new Student
            {
                FirstName = "Deleted",
                LastName = "Student",
                Email = "deleted@example.com",
                EnrollmentNumber = "STU-2026-100004",
                DateOfBirth = new DateTime(1995, 4, 4),
                IsDeleted = true,
                DeletedDate = DateTime.UtcNow
            }
        };

        await context.Students.AddRangeAsync(students);
        await context.SaveChangesAsync();
        return context;
    }

    [Fact]
    public async Task GetByEmailAsync_ReturnsMatchingStudent_WhenEmailExists()
    {
        await using var context = await SeedAsync(CreateContext());
        var repository = new StudentRepository(context);

        var result = await repository.GetByEmailAsync("amy.adams@example.com");

        result.Should().NotBeNull();
        result!.FirstName.Should().Be("Amy");
    }

    [Fact]
    public async Task GetByEmailAsync_ReturnsNull_WhenEmailDoesNotExist()
    {
        await using var context = await SeedAsync(CreateContext());
        var repository = new StudentRepository(context);

        var result = await repository.GetByEmailAsync("nobody@example.com");

        result.Should().BeNull();
    }

    [Fact]
    public async Task EmailExistsAsync_IgnoresSoftDeletedStudents()
    {
        await using var context = await SeedAsync(CreateContext());
        var repository = new StudentRepository(context);

        var existsForActive = await repository.EmailExistsAsync("amy.adams@example.com");
        var existsForDeleted = await repository.EmailExistsAsync("deleted@example.com");

        existsForActive.Should().BeTrue();
        existsForDeleted.Should().BeFalse();
    }

    [Fact]
    public async Task GetPagedAsync_FiltersAndPaginatesCorrectly()
    {
        await using var context = await SeedAsync(CreateContext());
        var repository = new StudentRepository(context);

        var (firstPageItems, totalCount) = await repository.GetPagedAsync(
            pageNumber: 1,
            pageSize: 2,
            orderBy: q => q.OrderBy(s => s.FirstName));

        totalCount.Should().Be(3); // the soft-deleted student must be excluded
        firstPageItems.Should().HaveCount(2);
        firstPageItems.Select(s => s.FirstName).Should().ContainInOrder("Amy", "Ben");

        var (secondPageItems, _) = await repository.GetPagedAsync(
            pageNumber: 2,
            pageSize: 2,
            orderBy: q => q.OrderBy(s => s.FirstName));

        secondPageItems.Should().ContainSingle();
        secondPageItems[0].FirstName.Should().Be("Cara");
    }

    [Fact]
    public async Task GetPagedAsync_AppliesFilterExpression()
    {
        await using var context = await SeedAsync(CreateContext());
        var repository = new StudentRepository(context);

        var (items, totalCount) = await repository.GetPagedAsync(
            pageNumber: 1,
            pageSize: 10,
            filter: s => s.LastName == "Baker");

        totalCount.Should().Be(1);
        items.Should().ContainSingle(s => s.Email == "ben.baker@example.com");
    }
}
