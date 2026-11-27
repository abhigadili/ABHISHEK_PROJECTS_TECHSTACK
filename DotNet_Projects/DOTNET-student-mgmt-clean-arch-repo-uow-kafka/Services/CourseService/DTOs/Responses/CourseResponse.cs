namespace StudentMgmt.CourseService.DTOs.Responses;

public class CourseResponse
{
    public Guid Id { get; set; }
    public string CourseCode { get; set; } = default!;
    public string Title { get; set; } = default!;
    public string Description { get; set; } = default!;
    public int Credits { get; set; }
    public int Capacity { get; set; }
    public string InstructorName { get; set; } = default!;
    public bool IsActive { get; set; }
    public DateTime CreatedDate { get; set; }
}
