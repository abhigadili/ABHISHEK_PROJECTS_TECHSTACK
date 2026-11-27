using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Moq;
using StudentMgmt.BuildingBlocks.Contracts.Common;
using StudentMgmt.StudentService.Controllers;
using StudentMgmt.StudentService.DTOs.Requests;
using StudentMgmt.StudentService.DTOs.Responses;
using StudentMgmt.StudentService.Services.Interfaces;
using Xunit;

namespace StudentMgmt.StudentService.Tests;

public class StudentsControllerTests
{
    private readonly Mock<IStudentAppService> _studentAppServiceMock = new();
    private readonly StudentsController _sut;

    public StudentsControllerTests()
    {
        _sut = new StudentsController(_studentAppServiceMock.Object);
    }

    [Fact]
    public async Task Create_ReturnsCreatedAtAction_WithSuccessApiResponse()
    {
        var response = new StudentResponse
        {
            Id = Guid.NewGuid(),
            FirstName = "Ada",
            LastName = "Lovelace",
            Email = "ada@example.com",
            EnrollmentNumber = "STU-2026-000001"
        };
        _studentAppServiceMock
            .Setup(s => s.CreateAsync(It.IsAny<CreateStudentRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(response);

        var result = await _sut.Create(new CreateStudentRequest { FirstName = "Ada", LastName = "Lovelace", Email = "ada@example.com" }, CancellationToken.None);

        var createdResult = result.Result.Should().BeOfType<CreatedResult>().Subject;
        var body = createdResult.Value.Should().BeOfType<ApiResponse<StudentResponse>>().Subject;
        body.Success.Should().BeTrue();
        body.Data!.Email.Should().Be("ada@example.com");
    }

    [Fact]
    public async Task GetById_ReturnsOkWithApiResponse()
    {
        var id = Guid.NewGuid();
        var response = new StudentResponse { Id = id, FirstName = "Ada", LastName = "Lovelace", Email = "ada@example.com", EnrollmentNumber = "STU-2026-000001" };
        _studentAppServiceMock.Setup(s => s.GetByIdAsync(id, It.IsAny<CancellationToken>())).ReturnsAsync(response);

        var result = await _sut.GetById(id, CancellationToken.None);

        var okResult = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var body = okResult.Value.Should().BeOfType<ApiResponse<StudentResponse>>().Subject;
        body.Success.Should().BeTrue();
        body.Data!.Id.Should().Be(id);
    }

    [Fact]
    public async Task GetPaged_ReturnsOkWithPagedApiResponse()
    {
        var pagedResult = PagedResult<StudentResponse>.Create(
            new List<StudentResponse>
            {
                new() { Id = Guid.NewGuid(), FirstName = "Ada", LastName = "Lovelace", Email = "ada@example.com", EnrollmentNumber = "STU-2026-000001" }
            },
            pageNumber: 1,
            pageSize: 10,
            totalCount: 1);

        _studentAppServiceMock
            .Setup(s => s.GetPagedAsync(It.IsAny<PagedRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(pagedResult);

        var result = await _sut.GetPaged(new PagedRequest(), CancellationToken.None);

        var okResult = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var body = okResult.Value.Should().BeOfType<ApiResponse<PagedResult<StudentResponse>>>().Subject;
        body.Data!.TotalCount.Should().Be(1);
        body.Data.Items.Should().ContainSingle();
    }

    [Fact]
    public async Task Update_ReturnsOkWithUpdatedStudent()
    {
        var id = Guid.NewGuid();
        var response = new StudentResponse { Id = id, FirstName = "Updated", LastName = "Name", Email = "updated@example.com", EnrollmentNumber = "STU-2026-000002" };
        _studentAppServiceMock
            .Setup(s => s.UpdateAsync(id, It.IsAny<UpdateStudentRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(response);

        var result = await _sut.Update(id, new UpdateStudentRequest { FirstName = "Updated", LastName = "Name", Email = "updated@example.com" }, CancellationToken.None);

        var okResult = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var body = okResult.Value.Should().BeOfType<ApiResponse<StudentResponse>>().Subject;
        body.Data!.FirstName.Should().Be("Updated");
    }

    [Fact]
    public async Task Delete_ReturnsOkWithSuccessApiResponse()
    {
        var id = Guid.NewGuid();
        _studentAppServiceMock.Setup(s => s.DeleteAsync(id, It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

        var result = await _sut.Delete(id, CancellationToken.None);

        var okResult = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var body = okResult.Value.Should().BeOfType<ApiResponse<object>>().Subject;
        body.Success.Should().BeTrue();
        _studentAppServiceMock.Verify(s => s.DeleteAsync(id, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task GetProfile_ReturnsOkWithApiResponse()
    {
        var id = Guid.NewGuid();
        var response = new StudentResponse { Id = id, FirstName = "Ada", LastName = "Lovelace", Email = "ada@example.com", EnrollmentNumber = "STU-2026-000001" };
        _studentAppServiceMock.Setup(s => s.GetProfileAsync(id, It.IsAny<CancellationToken>())).ReturnsAsync(response);

        var result = await _sut.GetProfile(id, CancellationToken.None);

        var okResult = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var body = okResult.Value.Should().BeOfType<ApiResponse<StudentResponse>>().Subject;
        body.Data!.Id.Should().Be(id);
    }
}
