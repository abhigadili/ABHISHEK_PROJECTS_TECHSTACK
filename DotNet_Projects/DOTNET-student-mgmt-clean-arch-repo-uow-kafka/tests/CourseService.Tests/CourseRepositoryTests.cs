using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using StudentMgmt.CourseService.Entities;
using StudentMgmt.CourseService.Persistence;
using StudentMgmt.CourseService.Repositories;
using Xunit;

namespace StudentMgmt.CourseService.Tests;

public class CourseRepositoryTests
{
    private static CourseDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<CourseDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new CourseDbContext(options);
    }

    private static async Task<CourseDbContext> SeedAsync()
    {
        var context = CreateContext();

        context.Courses.AddRange(
            new Course { CourseCode = "CS101", Title = "Intro to Computer Science", Description = "d", Credits = 3, Capacity = 30, InstructorName = "Ada Lovelace", IsActive = true },
            new Course { CourseCode = "CS202", Title = "Data Structures", Description = "d", Credits = 4, Capacity = 25, InstructorName = "Grace Hopper", IsActive = true },
            new Course { CourseCode = "MA101", Title = "Calculus I", Description = "d", Credits = 4, Capacity = 50, InstructorName = "Alan Turing", IsActive = true },
            new Course { CourseCode = "MA202", Title = "Linear Algebra", Description = "d", Credits = 3, Capacity = 40, InstructorName = "Alan Turing", IsActive = true },
            new Course { CourseCode = "PH101", Title = "Physics I", Description = "d", Credits = 3, Capacity = 60, InstructorName = "Marie Curie", IsActive = true, IsDeleted = true }
        );

        await context.SaveChangesAsync();
        return context;
    }

    [Fact]
    public async Task GetByCourseCodeAsync_ReturnsMatchingCourse()
    {
        await using var context = await SeedAsync();
        var repository = new CourseRepository(context);

        var course = await repository.GetByCourseCodeAsync("CS202");

        course.Should().NotBeNull();
        course!.Title.Should().Be("Data Structures");
    }

    [Fact]
    public async Task GetByCourseCodeAsync_IgnoresSoftDeletedCourses()
    {
        await using var context = await SeedAsync();
        var repository = new CourseRepository(context);

        var course = await repository.GetByCourseCodeAsync("PH101");

        course.Should().BeNull();
    }

    [Fact]
    public async Task CourseCodeExistsAsync_ReturnsTrueOnlyForNonDeletedMatches()
    {
        await using var context = await SeedAsync();
        var repository = new CourseRepository(context);

        (await repository.CourseCodeExistsAsync("CS101")).Should().BeTrue();
        (await repository.CourseCodeExistsAsync("PH101")).Should().BeFalse();
        (await repository.CourseCodeExistsAsync("DOES-NOT-EXIST")).Should().BeFalse();
    }

    [Fact]
    public async Task GetPagedAsync_ExcludesSoftDeletedRows()
    {
        await using var context = await SeedAsync();
        var repository = new CourseRepository(context);

        var (items, totalCount) = await repository.GetPagedAsync(1, 10);

        totalCount.Should().Be(4);
        items.Should().NotContain(c => c.CourseCode == "PH101");
    }

    [Fact]
    public async Task GetPagedAsync_AppliesSearchFilterOnTitleOrCourseCode()
    {
        await using var context = await SeedAsync();
        var repository = new CourseRepository(context);
        const string term = "MA";

        var (items, totalCount) = await repository.GetPagedAsync(
            1,
            10,
            filter: c => c.Title.Contains(term) || c.CourseCode.Contains(term));

        totalCount.Should().Be(2);
        items.Select(c => c.CourseCode).Should().BeEquivalentTo(new[] { "MA101", "MA202" });
    }

    [Fact]
    public async Task GetPagedAsync_SortsAscendingByCourseCode()
    {
        await using var context = await SeedAsync();
        var repository = new CourseRepository(context);

        var (items, _) = await repository.GetPagedAsync(
            1,
            10,
            orderBy: query => query.OrderBy(c => c.CourseCode));

        items.Select(c => c.CourseCode).Should().BeInAscendingOrder();
        items.First().CourseCode.Should().Be("CS101");
    }

    [Fact]
    public async Task GetPagedAsync_SortsDescendingByCredits()
    {
        await using var context = await SeedAsync();
        var repository = new CourseRepository(context);

        var (items, _) = await repository.GetPagedAsync(
            1,
            10,
            orderBy: query => query.OrderByDescending(c => c.Credits));

        items.Select(c => c.Credits).Should().BeInDescendingOrder();
    }

    [Fact]
    public async Task GetPagedAsync_PaginatesResultsCorrectly()
    {
        await using var context = await SeedAsync();
        var repository = new CourseRepository(context);

        var (firstPage, totalCount) = await repository.GetPagedAsync(1, 2, orderBy: query => query.OrderBy(c => c.CourseCode));
        var (secondPage, _) = await repository.GetPagedAsync(2, 2, orderBy: query => query.OrderBy(c => c.CourseCode));

        totalCount.Should().Be(4);
        firstPage.Should().HaveCount(2);
        secondPage.Should().HaveCount(2);
        firstPage.Select(c => c.CourseCode).Should().NotIntersectWith(secondPage.Select(c => c.CourseCode));
    }

    [Fact]
    public void Update_AssignsFreshRowVersionAndMarksUpdatedDate()
    {
        using var context = CreateContext();
        var repository = new CourseRepository(context);
        var course = new Course { CourseCode = "CS999", Title = "Temp", Description = "d", Credits = 3, Capacity = 10, InstructorName = "X" };

        repository.Update(course);

        course.RowVersion.Should().NotBeNull();
        course.RowVersion.Should().HaveCount(16);
        course.UpdatedDate.Should().NotBeNull();
    }

    [Fact]
    public void Remove_SoftDeletesEntity()
    {
        using var context = CreateContext();
        var repository = new CourseRepository(context);
        var course = new Course { CourseCode = "CS998", Title = "Temp", Description = "d", Credits = 3, Capacity = 10, InstructorName = "X" };

        repository.Remove(course);

        course.IsDeleted.Should().BeTrue();
        course.DeletedDate.Should().NotBeNull();
    }
}
